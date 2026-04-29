import type { Request } from 'express';
import { AuthService } from './auth.service';
export declare class AuthController {
    private auth;
    constructor(auth: AuthService);
    loginUser(body: {
        email: string;
        password: string;
    }, req: Request): Promise<{
        tokens: {
            accessToken: string;
            refreshToken: string;
            expiresIn: number;
        };
        user: any;
    }>;
    loginPartner(body: {
        email: string;
        password: string;
    }, req: Request): Promise<{
        tokens: {
            accessToken: string;
            refreshToken: string;
            expiresIn: number;
        };
        partner: any;
    }>;
    loginAdmin(body: {
        email: string;
        password: string;
    }, req: Request): Promise<{
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
    refresh(body: {
        refreshToken: string;
    }, req: Request): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    }>;
    logout(body: {
        refreshToken: string;
    }): Promise<void>;
}
