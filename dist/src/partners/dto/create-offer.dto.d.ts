export declare class CreateOfferDto {
    title: string;
    description: string;
    category: string;
    discount: number;
    originalPrice: number;
    pointsRequired: number;
    image?: string;
    maxRedemptions?: number;
    validUntil?: string;
    restrictions?: string;
}
