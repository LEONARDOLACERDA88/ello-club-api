import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'

const BASE_URL = process.env.CLUBE_CERTO_BASE_URL || 'https://node.clubecerto.com.br/superapp'
const COMPANY_ID = process.env.CLUBE_CERTO_COMPANY_ID || '1735'

// Mapa de categorias Clube Certo → categorias ELLO
const CAT_MAP: Record<string, string> = {
  'Gastronomia':          'Gastronomia',
  'Saúde':                'Saúde',
  'Educação':             'Educação',
  'Beleza e Estética':    'Beleza',
  'Moda':                 'Moda',
  'Turismo':              'Viagem',
  'Delivery':             'Gastronomia',
  'Hospedagem':           'Hotelaria',
  'Automotivo':           'Outros',
  'Comércio':             'Outros',
  'Serviços':             'Outros',
  'Loja virtual':         'Outros',
  'Pets':                 'Pets',
  'Fitness':              'Esporte',
  'Lazer':                'Entretenimento',
  'Cinema':               'Entretenimento',
  'Posto de Combustível': 'Outros',
  'Café':                 'Gastronomia',
}

@Injectable()
export class ClubeCertoService implements OnModuleInit {
  private readonly logger = new Logger(ClubeCertoService.name)
  private companyToken: string | null = null
  private tokenExpiresAt: number = 0

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // Garante que as tabelas existam — cada statement separado para compatibilidade com pg
    const exec = (sql: string) => (this.prisma as any).$executeRawUnsafe(sql)
    try {
      // 1. Enum
      await exec(`DO $$ BEGIN CREATE TYPE "IntegrationType" AS ENUM ('AFFILIATE','API_DIRECT','WIDGET','QR_VOUCHER','POSTBACK'); EXCEPTION WHEN duplicate_object THEN null; END $$`)
      // 2. Tabela principal
      await exec(`CREATE TABLE IF NOT EXISTS "external_partners" ("id" TEXT NOT NULL,"name" TEXT NOT NULL,"category" TEXT NOT NULL,"description" TEXT,"logo" TEXT,"image" TEXT,"discount" INTEGER NOT NULL DEFAULT 0,"integrationType" "IntegrationType" NOT NULL DEFAULT 'AFFILIATE',"affiliateUrl" TEXT,"apiEndpoint" TEXT,"apiKey" TEXT,"widgetUrl" TEXT,"voucherCode" TEXT,"webhookSecret" TEXT,"source" TEXT DEFAULT 'manual',"externalId" TEXT,"clickCount" INTEGER NOT NULL DEFAULT 0,"conversionCount" INTEGER NOT NULL DEFAULT 0,"totalSavings" DECIMAL(10,2) NOT NULL DEFAULT 0,"status" TEXT NOT NULL DEFAULT 'active',"featured" BOOLEAN NOT NULL DEFAULT false,"sortOrder" INTEGER NOT NULL DEFAULT 0,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "external_partners_pkey" PRIMARY KEY ("id"))`)
      // 3. Tabela de clicks
      await exec(`CREATE TABLE IF NOT EXISTS "external_clicks" ("id" TEXT NOT NULL,"externalPartnerId" TEXT NOT NULL,"userId" TEXT,"sessionId" TEXT,"savingsAmount" DECIMAL(10,2),"converted" BOOLEAN NOT NULL DEFAULT false,"convertedAt" TIMESTAMP(3),"ipAddress" TEXT,"userAgent" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "external_clicks_pkey" PRIMARY KEY ("id"))`)
      // 4. Unique constraint (necessário para upsert do Prisma via ON CONFLICT)
      // Se existir um partial index com o mesmo nome (da migration antiga), dropar primeiro
      await exec(`DROP INDEX IF EXISTS "external_partners_externalId_source_key"`)
      await exec(`DO $$ BEGIN ALTER TABLE "external_partners" ADD CONSTRAINT "external_partners_externalId_source_key" UNIQUE ("externalId","source"); EXCEPTION WHEN duplicate_object THEN null; END $$`)
      // 5. Índices opcionais
      await exec(`CREATE INDEX IF NOT EXISTS "external_partners_status_idx" ON "external_partners"("status")`)
      await exec(`CREATE INDEX IF NOT EXISTS "external_partners_source_idx" ON "external_partners"("source")`)
      this.logger.log('Tabelas external_partners e external_clicks verificadas/criadas')
    } catch (err: any) {
      this.logger.error('Erro ao criar tabelas Clube Certo:', err.message)
    }
  }

  // ── Autenticação ─────────────────────────────────────────────────────────────

  async getCompanyToken(): Promise<string> {
    // Reutiliza token por 55 min (JWT expira em 1h)
    if (this.companyToken && Date.now() < this.tokenExpiresAt) {
      return this.companyToken
    }

    const cnpj = process.env.CLUBE_CERTO_CNPJ?.replace(/\D/g, '') || ''
    const password = process.env.CLUBE_CERTO_PASSWORD || ''

    const res = await fetch(`${BASE_URL}/companyAPI/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cnpj, password }),
    })

    if (!res.ok) throw new Error(`Clube Certo login falhou: ${res.status}`)
    const data = await res.json() as { token: string }

    this.companyToken = data.token
    this.tokenExpiresAt = Date.now() + 55 * 60 * 1000
    return this.companyToken
  }

  async getUserToken(cpf: string): Promise<string> {
    const companyToken = await this.getCompanyToken()
    const cleanCpf = cpf.replace(/\D/g, '')

    const res = await fetch(`${BASE_URL}/companyAPI/associate/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${companyToken}`,
      },
      body: JSON.stringify({ cpf: cleanCpf }),
    })

    if (!res.ok) throw new Error(`Token de usuário Clube Certo falhou: ${res.status}`)
    const data = await res.json() as { token: string }
    return data.token
  }

  // ── Sync principal — cron diário às 05:00 ────────────────────────────────────

  @Cron('0 5 * * *')
  async syncAll() {
    this.logger.log('Iniciando sync Clube Certo...')
    try {
      const token = await this.getCompanyToken()
      const userToken = await this.getUserTokenForSync(token)
      const [discountCount, cashbackCount] = await Promise.all([
        this.syncDiscounts(userToken),
        this.syncCashback(userToken),
      ])
      this.logger.log(`Sync concluído: ${discountCount} descontos, ${cashbackCount} cashback`)
      return { discounts: discountCount, cashback: cashbackCount, syncedAt: new Date() }
    } catch (err) {
      this.logger.error('Erro no sync Clube Certo:', err)
      throw err
    }
  }

  private async getUserTokenForSync(companyToken: string): Promise<string> {
    const testCpf = process.env.CLUBE_CERTO_TEST_CPF || '00000000001'
    const res = await fetch(`${BASE_URL}/companyAPI/associate/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${companyToken}`,
      },
      body: JSON.stringify({ cpf: testCpf }),
    })
    const data = await res.json() as { token: string }
    return data.token
  }

  private async syncDiscounts(userToken: string): Promise<number> {
    const res = await fetch(`${BASE_URL}/companyAPI/establishment/search`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    if (!res.ok) return 0

    const establishments = await res.json() as any[]
    let count = 0

    for (const est of establishments) {
      const category = CAT_MAP[est.category?.name] || 'Outros'
      const discountNum = parseInt((est.discount || '0').replace('%', '')) || 0
      const affiliateUrl = est.discountLink || est.store || null

      if (!affiliateUrl) continue

      await this.prisma.externalPartner.upsert({
        where: {
          // Usa externalId+source como chave única
          externalId_source: {
            externalId: String(est.id),
            source: 'clube_certo',
          },
        },
        create: {
          name: est.name,
          category,
          description: null,
          logo: est.brand || null,
          image: est.capa || est.brand || null,
          discount: discountNum,
          integrationType: 'AFFILIATE',
          affiliateUrl,
          source: 'clube_certo',
          externalId: String(est.id),
          status: 'active',
          featured: false,
          sortOrder: est.underHighlight || 0,
        },
        update: {
          name: est.name,
          category,
          logo: est.brand || null,
          image: est.capa || est.brand || null,
          discount: discountNum,
          affiliateUrl,
          sortOrder: est.underHighlight || 0,
          updatedAt: new Date(),
        },
      })
      count++
    }
    return count
  }

  private async syncCashback(userToken: string): Promise<number> {
    const res = await fetch(`${BASE_URL}/companyAPI/cashback`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    if (!res.ok) return 0

    const cashbacks = await res.json() as any[]
    let count = 0

    for (const cb of cashbacks) {
      if (!cb.visible || cb.status !== 'Active') continue

      const category = CAT_MAP[cb.categoryId] || 'Outros'
      // Link base sem CPF (CPF será injetado no frontend via /user-link)
      const affiliateUrl = cb.link || null
      if (!affiliateUrl) continue

      const discountNum = cb.max ? Math.round(parseFloat(cb.max)) : 0

      await this.prisma.externalPartner.upsert({
        where: {
          externalId_source: {
            externalId: `cb_${cb.id}`,
            source: 'clube_certo_cashback',
          },
        },
        create: {
          name: cb.name,
          category,
          description: cb.description || null,
          logo: null,
          image: null,
          discount: discountNum,
          integrationType: 'AFFILIATE',
          affiliateUrl,
          source: 'clube_certo_cashback',
          externalId: `cb_${cb.id}`,
          status: 'active',
          featured: false,
          sortOrder: 0,
        },
        update: {
          name: cb.name,
          category,
          description: cb.description || null,
          discount: discountNum,
          affiliateUrl,
          updatedAt: new Date(),
        },
      })
      count++
    }
    return count
  }

  // ── Link personalizado com CPF do usuário (para cashback rastreado) ──────────

  async getPersonalizedLink(partnerId: string, userCpf: string): Promise<string> {
    const partner = await this.prisma.externalPartner.findUnique({ where: { id: partnerId } })
    if (!partner?.affiliateUrl) throw new Error('Parceiro não encontrado')

    const cleanCpf = userCpf.replace(/\D/g, '')
    // Substitui o CPF de teste pelo CPF real do usuário no link de afiliado
    return partner.affiliateUrl.replace('00000000001', cleanCpf)
  }

  // ── Stats para o admin ───────────────────────────────────────────────────────

  async getStats() {
    const [discounts, cashback] = await Promise.all([
      this.prisma.externalPartner.count({ where: { source: 'clube_certo' } }),
      this.prisma.externalPartner.count({ where: { source: 'clube_certo_cashback' } }),
    ])
    const active = await this.prisma.externalPartner.count({
      where: { source: { in: ['clube_certo', 'clube_certo_cashback'] }, status: 'active' },
    })
    const inactive = await this.prisma.externalPartner.count({
      where: { source: { in: ['clube_certo', 'clube_certo_cashback'] }, status: 'inactive' },
    })
    return { discounts, cashback, total: discounts + cashback, active, inactive }
  }

  // ── Registrar usuário no Clube Certo (chamado no cadastro ELLO) ─────────────

  async registerUser(data: {
    name: string
    cpf: string
    email?: string
    birthDate?: string
    phone?: string
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const token = await this.getCompanyToken()
      const cleanCpf = data.cpf.replace(/\D/g, '')

      const body: any = {
        name: data.name,
        cpf: cleanCpf,
        discount: true,
        cashback: true,
      }
      if (data.email)     body.email = data.email
      if (data.birthDate) body.birthDate = data.birthDate
      if (data.phone)     body.phone = data.phone.replace(/\D/g, '')

      const res = await fetch(`${BASE_URL}/companyAPI/associate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as any
        this.logger.warn(`Clube Certo registerUser falhou para ${cleanCpf}: ${err?.error}`)
        return { success: false, error: err?.error || `HTTP ${res.status}` }
      }

      this.logger.log(`Usuário ${cleanCpf} registrado no Clube Certo`)
      return { success: true }
    } catch (err: any) {
      this.logger.error('Erro ao registrar usuário no Clube Certo:', err.message)
      return { success: false, error: err.message }
    }
  }

  // ── Categorias com cores e ícones oficiais ───────────────────────────────────

  async getCategories(): Promise<any[]> {
    const userToken = await this.getUserTokenForSync(await this.getCompanyToken())
    const res = await fetch(`${BASE_URL}/companyAPI/establishment/categories`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    if (!res.ok) return []
    return res.json()
  }

  // ── Busca dinâmica de estabelecimentos por cidade/categoria ──────────────────

  async searchEstablishments(params: {
    cityId?: number
    categoryId?: number
    search?: string
    page?: number
  }): Promise<any> {
    const userToken = await this.getUserTokenForSync(await this.getCompanyToken())
    const qs = new URLSearchParams()
    if (params.cityId)    qs.set('cityId', String(params.cityId))
    if (params.categoryId) qs.set('categoryId', String(params.categoryId))
    if (params.search)    qs.set('name', params.search)
    if (params.page)      qs.set('page', String(params.page))

    const res = await fetch(`${BASE_URL}/companyAPI/establishment/search?${qs}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    if (!res.ok) return { establishments: [], total: 0 }
    const data = await res.json()
    return Array.isArray(data) ? { establishments: data, total: data.length } : data
  }

  // ── Estados e cidades ────────────────────────────────────────────────────────

  async getStates(): Promise<any[]> {
    const userToken = await this.getUserTokenForSync(await this.getCompanyToken())
    const res = await fetch(`${BASE_URL}/locations/states`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    if (!res.ok) return []
    return res.json()
  }

  async getCities(stateId: number): Promise<any[]> {
    const userToken = await this.getUserTokenForSync(await this.getCompanyToken())
    const res = await fetch(`${BASE_URL}/locations/cities/${stateId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    if (!res.ok) return []
    return res.json()
  }

  // ── URL da carteira de cashback por CPF ──────────────────────────────────────

  getCashbackWalletUrl(cpf: string): string {
    const cleanCpf = cpf.replace(/\D/g, '')
    return `${BASE_URL.replace('node.clubecerto.com.br/superapp', 'integrations.clubecerto.com.br')}/webapp/${cleanCpf}/${COMPANY_ID}`
  }

  // ── Detalhes de estabelecimento ──────────────────────────────────────────────

  async getEstablishmentDetail(id: number): Promise<any> {
    const userToken = await this.getUserTokenForSync(await this.getCompanyToken())
    const res = await fetch(`${BASE_URL}/companyAPI/establishment/${id}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    if (!res.ok) return null
    return res.json()
  }

  // ── Toggle ativo/inativo (admin) ─────────────────────────────────────────────

  async toggleStatus(partnerId: string): Promise<{ status: string }> {
    const partner = await this.prisma.externalPartner.findUnique({ where: { id: partnerId } })
    if (!partner) throw new Error('Parceiro não encontrado')
    const newStatus = partner.status === 'active' ? 'inactive' : 'active'
    await this.prisma.externalPartner.update({
      where: { id: partnerId },
      data: { status: newStatus },
    })
    return { status: newStatus }
  }

  // ── Listar com filtros (admin) ───────────────────────────────────────────────

  async listForAdmin(params: { source?: string; category?: string; status?: string; search?: string }) {
    const where: any = {
      source: params.source
        ? params.source
        : { in: ['clube_certo', 'clube_certo_cashback'] },
    }
    if (params.category) where.category = params.category
    if (params.status) where.status = params.status
    if (params.search) where.name = { contains: params.search, mode: 'insensitive' }

    const partners = await this.prisma.externalPartner.findMany({
      where,
      orderBy: [{ status: 'asc' }, { sortOrder: 'desc' }, { name: 'asc' }],
      select: {
        id: true, name: true, category: true, logo: true, image: true,
        discount: true, source: true, status: true, featured: true,
        clickCount: true, conversionCount: true, externalId: true,
      },
    })

    return { partners, total: partners.length }
  }
}
