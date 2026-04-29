import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
export declare class AuthService {
    private prisma;
    private jwt;
    private config;
    private audit;
    constructor(prisma: PrismaService, jwt: JwtService, config: ConfigService, audit: AuditService);
    loginUser(email: string, password: string, ip?: string, ua?: string): Promise<{
        tokens: {
            accessToken: string;
            refreshToken: string;
            expiresIn: number;
        };
        user: any;
    }>;
    loginPartner(email: string, password: string, ip?: string, ua?: string): Promise<{
        tokens: {
            accessToken: string;
            refreshToken: string;
            expiresIn: number;
        };
        partner: any;
    }>;
    loginAdmin(email: string, password: string, ip?: string): Promise<{
        tokens: {
            accessToken: string;
            refreshToken: string;
            expiresIn: number;
        };
        admin: {
            id: any;
            name: any;
            email: any;
            role: any;
        };
    }>;
    refreshTokens(refreshToken: string, ip?: string): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    }>;
    logout(refreshToken: string): Promise<void>;
    private generateTokens;
    private safeUser;
    private safePartner;
}
