"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const bcrypt = __importStar(require("bcrypt"));
const adapter = new adapter_pg_1.PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' });
const prisma = new client_1.PrismaClient({ adapter });
async function main() {
    console.log('🌱 Iniciando seed...');
    const adminHash = await bcrypt.hash('Admin@2026', 12);
    const admin = await prisma.admin.upsert({
        where: { email: 'admin@elloclubmais.com.br' },
        update: {},
        create: {
            name: 'Administrador ELLO',
            email: 'admin@elloclubmais.com.br',
            passwordHash: adminHash,
            role: 'SUPER_ADMIN',
        },
    });
    console.log('✅ Admin criado:', admin.email);
    const partnerHash = await bcrypt.hash('Parceiro@2026', 12);
    const partners = await Promise.all([
        prisma.partner.upsert({
            where: { email: 'contato@vidasaudavel.com.br' },
            update: {},
            create: {
                name: 'Vida Saudável Clínica',
                email: 'contato@vidasaudavel.com.br',
                passwordHash: partnerHash,
                cnpj: '11.222.333/0001-44',
                category: 'Saúde e Bem-estar',
                description: 'Clínica de saúde integrada com médicos, nutricionistas e psicólogos.',
                phone: '(11) 3000-1111',
                status: 'ACTIVE',
                commissionRate: 8,
            },
        }),
        prisma.partner.upsert({
            where: { email: 'parceria@bouchon.com.br' },
            update: {},
            create: {
                name: 'Bouchon Bistrô',
                email: 'parceria@bouchon.com.br',
                passwordHash: partnerHash,
                cnpj: '22.333.444/0001-55',
                category: 'Gastronomia',
                description: 'Restaurante francês premiado no coração de São Paulo.',
                phone: '(11) 3000-2222',
                status: 'ACTIVE',
                commissionRate: 10,
            },
        }),
        prisma.partner.upsert({
            where: { email: 'parceiros@masterfit.com.br' },
            update: {},
            create: {
                name: 'MasterFit Academia',
                email: 'parceiros@masterfit.com.br',
                passwordHash: partnerHash,
                cnpj: '33.444.555/0001-66',
                category: 'Saúde e Bem-estar',
                description: 'Rede de academias com infraestrutura premium.',
                status: 'ACTIVE',
                commissionRate: 12,
            },
        }),
        prisma.partner.upsert({
            where: { email: 'negocios@techacademy.com.br' },
            update: {},
            create: {
                name: 'TechAcademy',
                email: 'negocios@techacademy.com.br',
                passwordHash: partnerHash,
                cnpj: '44.555.666/0001-77',
                category: 'Educação',
                description: 'Plataforma líder em cursos de tecnologia e negócios.',
                status: 'ACTIVE',
                commissionRate: 15,
            },
        }),
        prisma.partner.upsert({
            where: { email: 'clube@grandhotel.com.br' },
            update: {},
            create: {
                name: 'Grand Hotel & Spa',
                email: 'clube@grandhotel.com.br',
                passwordHash: partnerHash,
                cnpj: '55.666.777/0001-88',
                category: 'Hotelaria',
                description: 'Resort 5 estrelas com spa completo.',
                status: 'ACTIVE',
                commissionRate: 10,
            },
        }),
    ]);
    console.log(`✅ ${partners.length} parceiros criados`);
    const [clinica, bistrô, academia, tech, hotel] = partners;
    const offersData = [
        { partnerId: clinica.id, title: 'Consulta médica com 40% OFF', description: 'Clínica Geral, Cardiologia e Dermatologia', category: 'Saúde e Bem-estar', discount: 40, originalPrice: 250, pointsRequired: 0, image: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400' },
        { partnerId: clinica.id, title: 'Exames laboratoriais — 30% OFF', description: 'Hemograma, glicemia, colesterol e mais 20 exames', category: 'Saúde e Bem-estar', discount: 30, originalPrice: 180, pointsRequired: 0, image: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=400' },
        { partnerId: bistrô.id, title: 'Menu degustação — 35% OFF', description: '5 tempos com harmonização de vinhos', category: 'Gastronomia', discount: 35, originalPrice: 320, pointsRequired: 500, image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400' },
        { partnerId: bistrô.id, title: 'Almoço executivo — 25% OFF', description: 'Entrada + Prato + Sobremesa + Café', category: 'Gastronomia', discount: 25, originalPrice: 85, pointsRequired: 0, image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400' },
        { partnerId: academia.id, title: 'Mensalidade academia — 50% 1º mês', description: 'Acesso completo: musculação, piscina, aulas coletivas', category: 'Saúde e Bem-estar', discount: 50, originalPrice: 199, pointsRequired: 0, image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400' },
        { partnerId: academia.id, title: 'Personal trainer — 3 sessões 40% OFF', description: 'Treinos personalizados com profissional certificado', category: 'Saúde e Bem-estar', discount: 40, originalPrice: 450, pointsRequired: 300, image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400' },
        { partnerId: tech.id, title: 'Curso de IA — 60% OFF', description: 'Python, Machine Learning e ChatGPT para negócios', category: 'Educação', discount: 60, originalPrice: 497, pointsRequired: 0, image: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=400' },
        { partnerId: tech.id, title: 'Bootcamp Full Stack — 45% OFF', description: 'React, Node.js e AWS em 12 semanas', category: 'Educação', discount: 45, originalPrice: 2997, pointsRequired: 1000, image: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400' },
        { partnerId: hotel.id, title: 'Day use com spa — 30% OFF', description: 'Piscina, sauna, ofurô e 1 massagem 50min', category: 'Hotelaria', discount: 30, originalPrice: 380, pointsRequired: 500, image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400' },
        { partnerId: hotel.id, title: 'Diária casal — 20% OFF', description: 'Suíte luxo com café da manhã incluso', category: 'Hotelaria', discount: 20, originalPrice: 850, pointsRequired: 1000, image: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400' },
    ];
    for (const o of offersData) {
        const finalPrice = parseFloat((o.originalPrice * (1 - o.discount / 100)).toFixed(2));
        await prisma.offer.upsert({
            where: { id: `seed-${o.title.slice(0, 20).replace(/\s/g, '-')}` },
            update: {},
            create: { ...o, finalPrice, status: 'ACTIVE', id: `seed-${o.title.slice(0, 20).replace(/\s/g, '-')}` },
        });
    }
    console.log(`✅ ${offersData.length} ofertas criadas`);
    const userHash = await bcrypt.hash('Demo@2026', 12);
    const user = await prisma.user.upsert({
        where: { email: 'demo@elloclubmais.com.br' },
        update: {},
        create: {
            name: 'Leonardo Demo',
            email: 'demo@elloclubmais.com.br',
            passwordHash: userHash,
            points: 2500,
            lgpdConsentAt: new Date(),
            lgpdConsentIp: '127.0.0.1',
            lgpdConsentVersion: '1.0',
        },
    });
    console.log('✅ Usuário demo criado:', user.email);
    console.log('\n🚀 Seed concluído! Credenciais:');
    console.log('  Admin:   admin@elloclubmais.com.br / Admin@2026');
    console.log('  Usuário: demo@elloclubmais.com.br  / Demo@2026');
    console.log('  Parceiro: contato@vidasaudavel.com.br / Parceiro@2026');
}
main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=seed.js.map