export interface Ticket {
    _id?: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    user?: any;
    createdAt?: Date;
    updatedAt?: Date;
    response?: string;
    type?: string;
}

export interface CreateTicketDto {
    title: string;
    description: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
}
