import type { Request } from 'express';
import { NotificationsService } from './notifications.service';
export declare class NotificationsController {
    private readonly svc;
    constructor(svc: NotificationsService);
    vapidKey(): {
        publicKey: string;
    };
    subscribe(user: any, body: {
        endpoint: string;
        keys: {
            auth: string;
            p256dh: string;
        };
    }, req: Request): Promise<any>;
    unsubscribe(user: any, body: {
        endpoint: string;
    }): Promise<void>;
    list(user: any): Promise<any>;
    unreadCount(user: any): Promise<{
        count: number;
    }>;
    markAllRead(user: any): Promise<any>;
    markRead(user: any, id: string): Promise<any>;
    broadcast(body: {
        title: string;
        body: string;
        url?: string;
        level?: string;
    }): Promise<{
        sent: number;
    }>;
}
