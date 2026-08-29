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
    diagnostics?: SupportTicketDiagnostics;
}

export interface SupportConsoleDiagnostic {
    level: 'warn' | 'error';
    message: string;
    route: string;
    occurred_at: string;
}

export interface SupportTicketDiagnostics {
    route: string;
    browser: string;
    captured_at: string;
    viewport: string;
    console_entries: SupportConsoleDiagnostic[];
    screenshot_url?: string;
    screenshot_file_id?: string;
    screenshot_name?: string;
}

export interface SupportDiagnosticCapture {
    diagnostics: SupportTicketDiagnostics;
    summary: string;
    screenshotDataUrl?: string;
    screenshotFile?: File;
}

export interface CreateTicketDto {
    title: string;
    description: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface SupportAssistantMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface SupportAssistantRequest {
    messages: SupportAssistantMessage[];
    route?: string;
    browser?: string;
    diagnostics?: string;
    screenshot_data_url?: string;
}

export interface SupportAssistantResponse {
    message: string;
    ready: boolean;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
}
