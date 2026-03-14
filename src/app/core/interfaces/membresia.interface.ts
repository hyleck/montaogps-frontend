export interface Oferta {
    _id?: string;
    name: string;
    description?: string;
    discount_percentage: number;
    promotional_price: number;
}

export interface Membresia {
    _id?: string;
    name: string;
    description?: string;
    duration_type: string;
    price: number;
    currency: string;
    active: boolean;
    ofertas: Oferta[];
    createdAt?: string;
    updatedAt?: string;
}
