import { ClubeCertoService } from './clube-certo.service';
export declare class ClubeCertoController {
    private readonly svc;
    constructor(svc: ClubeCertoService);
    sync(): Promise<{
        discounts: number;
        cashback: number;
        syncedAt: Date;
    }>;
    stats(): Promise<{
        discounts: any;
        cashback: any;
        total: any;
        active: any;
        inactive: any;
    }>;
    listAdmin(source?: string, category?: string, status?: string, search?: string): Promise<{
        partners: any;
        total: any;
    }>;
    toggle(id: string): Promise<{
        status: string;
    }>;
    getLink(id: string, user: any): Promise<{
        url: string;
    }>;
    listPublic(category?: string, source?: string): Promise<{
        partners: any;
        total: any;
    }>;
}
