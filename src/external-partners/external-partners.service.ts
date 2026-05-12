import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import * as crypto from 'crypto'

@Injectable()
export class ExternalPartnersService {
  constructor(private prisma: PrismaService) {}

  // ── Listar parceiros externos (público) ───────────────────────────────────
  async findAll(params: { category?: string; source?: string; integrationType?: string }) {
    const where: any = { status: 'active' }
    if (params.category) where.category = params.category
    if (params.source) where.source = params.source
    if (params.integrationType) where.integrationType = params.integrationType

    const partners = await this.prisma.externalPartner.findMany({
      where,
      select: {
        id: true, name: true, category: true, description: true,
        logo: true, image: true, discount: true, integrationType: true,
        affiliateUrl: true, widgetUrl: true, voucherCode: true,
        source: true, featured: true, sortOrder: true,
        clickCount: true, conversionCount: true,
        // Nunca expõe apiKey ou webhookSecret publicamente
      },
      orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
    })

    return { partners, total: partners.length }
  }

  // ── Detalhe (público) ─────────────────────────────────────────────────────
  async findOne(id: string) {
    const p = await this.prisma.externalPartner.findUnique({
      where: { id },
      select: {
        id: true, name: true, category: true, description: true,
        logo: true, image: true, discount: true, integrationType: true,
        affiliateUrl: true, widgetUrl: true, voucherCode: true,
        apiEndpoint: true, source: true, featured: true,
        clickCount: true, conversionCount: true, totalSavings: true,
      },
    })
    if (!p || p === null) throw new NotFoundException('Parceiro externo não encontrado')
    return p
  }

  // ── Registrar clique ──────────────────────────────────────────────────────
  async trackClick(partnerId: string, userId?: string, sessionId?: string, ip?: string, ua?: string) {
    const partner = await this.prisma.externalPartner.findUnique({ where: { id: partnerId } })
    if (!partner) throw new NotFoundException('Parceiro não encontrado')

    const [click] = await this.prisma.$transaction([
      this.prisma.externalClick.create({
        data: { externalPartnerId: partnerId, userId, sessionId, ipAddress: ip, userAgent: ua },
      }),
      this.prisma.externalPartner.update({
        where: { id: partnerId },
        data: { clickCount: { increment: 1 } },
      }),
    ])

    // Retorna a URL de destino para o frontend redirecionar
    return {
      clickId: click.id,
      redirectUrl: partner.affiliateUrl || partner.widgetUrl || null,
    }
  }

  // ── Receber postback de conversão ─────────────────────────────────────────
  async receivePostback(partnerId: string, payload: {
    clickId?: string
    sessionId?: string
    savingsAmount: number
    secret: string
  }) {
    const partner = await this.prisma.externalPartner.findUnique({ where: { id: partnerId } })
    if (!partner) throw new NotFoundException('Parceiro não encontrado')

    // Valida secret do parceiro
    if (partner.webhookSecret) {
      const expected = crypto
        .createHmac('sha256', partner.webhookSecret)
        .update(`${partnerId}:${payload.savingsAmount}`)
        .digest('hex')
      if (payload.secret !== expected) {
        return { ok: false, message: 'Secret inválido' }
      }
    }

    // Encontra o clique e marca como convertido
    const where: any = {}
    if (payload.clickId) where.id = payload.clickId
    else if (payload.sessionId) where.sessionId = payload.sessionId
    else return { ok: false, message: 'clickId ou sessionId obrigatório' }

    await this.prisma.$transaction([
      this.prisma.externalClick.updateMany({
        where: { ...where, externalPartnerId: partnerId, converted: false },
        data: {
          converted: true,
          convertedAt: new Date(),
          savingsAmount: payload.savingsAmount,
        },
      }),
      this.prisma.externalPartner.update({
        where: { id: partnerId },
        data: {
          conversionCount: { increment: 1 },
          totalSavings: { increment: payload.savingsAmount },
        },
      }),
    ])

    return { ok: true }
  }

  // ── ADMIN: criar parceiro externo ─────────────────────────────────────────
  async create(data: {
    name: string; category: string; description?: string; logo?: string; image?: string
    discount?: number; integrationType: string; affiliateUrl?: string; apiEndpoint?: string
    apiKey?: string; widgetUrl?: string; voucherCode?: string; webhookSecret?: string
    source?: string; externalId?: string; featured?: boolean; sortOrder?: number
  }) {
    return this.prisma.externalPartner.create({
      data: {
        ...data,
        integrationType: data.integrationType as any,
        source: data.source || 'manual',
      },
    })
  }

  // ── ADMIN: atualizar parceiro externo ─────────────────────────────────────
  async update(id: string, data: Partial<{
    name: string; category: string; description: string; logo: string; image: string
    discount: number; affiliateUrl: string; apiEndpoint: string; apiKey: string
    widgetUrl: string; voucherCode: string; webhookSecret: string
    status: string; featured: boolean; sortOrder: number; source: string
  }>) {
    return this.prisma.externalPartner.update({ where: { id }, data })
  }

  // ── ADMIN: excluir parceiro externo ───────────────────────────────────────
  async remove(id: string) {
    await this.prisma.externalPartner.delete({ where: { id } })
    return { ok: true }
  }

  // ── ADMIN: importar em massa (CSV/Planilha) ───────────────────────────────
  async importBulk(partners: Array<{
    name: string; category: string; integrationType: string
    affiliateUrl?: string; apiEndpoint?: string; widgetUrl?: string
    voucherCode?: string; discount?: number; logo?: string; image?: string
    description?: string; source?: string; externalId?: string
  }>) {
    const results = { created: 0, skipped: 0, errors: [] as string[] }

    for (const p of partners) {
      try {
        // Evita duplicatas por externalId + source
        if (p.externalId && p.source) {
          const existing = await this.prisma.externalPartner.findFirst({
            where: { externalId: p.externalId, source: p.source },
          })
          if (existing) { results.skipped++; continue }
        }
        await this.prisma.externalPartner.create({
          data: { ...p, integrationType: p.integrationType as any, source: p.source || 'import' },
        })
        results.created++
      } catch (e) {
        results.errors.push(`${p.name}: ${e instanceof Error ? e.message : 'erro'}`)
      }
    }

    return results
  }

  // ── ADMIN: estatísticas ───────────────────────────────────────────────────
  async getStats() {
    const [total, byType, topClicked, totalSavings] = await Promise.all([
      this.prisma.externalPartner.count({ where: { status: 'active' } }),
      this.prisma.externalPartner.groupBy({
        by: ['integrationType'],
        _count: { id: true },
      }),
      this.prisma.externalPartner.findMany({
        where: { status: 'active' },
        orderBy: { clickCount: 'desc' },
        take: 5,
        select: { id: true, name: true, clickCount: true, conversionCount: true, totalSavings: true },
      }),
      this.prisma.externalPartner.aggregate({
        _sum: { totalSavings: true, clickCount: true, conversionCount: true },
      }),
    ])

    return {
      total,
      byType: byType.map(b => ({ type: b.integrationType, count: b._count.id })),
      topClicked,
      totals: {
        clicks: Number(totalSavings._sum.clickCount ?? 0),
        conversions: Number(totalSavings._sum.conversionCount ?? 0),
        savings: Number(totalSavings._sum.totalSavings ?? 0),
      },
    }
  }
}
