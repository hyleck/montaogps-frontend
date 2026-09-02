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
    console_entries?: SupportConsoleDiagnostic[];
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

export interface SupportImageAttachment {
    name: string;
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
    dataUrl: string;
    previewUrl: string;
    file: File;
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
    page_context?: string;
    diagnostics?: string;
    screenshot_data_url?: string;
    image_data_url?: string;
}

export interface SupportAssistantResponse {
    message: string;
    ready: boolean;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    outcome?: 'conversation' | 'resolved' | 'needs_confirmation' | 'ticket';
    action_summary?: string;
}
