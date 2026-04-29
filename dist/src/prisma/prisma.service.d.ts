import 'dotenv/config';
declare const PrismaService_base: any;
export declare class PrismaService extends PrismaService_base {
    private static _client;
    constructor();
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
}
export {};
