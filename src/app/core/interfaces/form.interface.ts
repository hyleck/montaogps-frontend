export interface FormField {
    label: string;
    type: string;
    placeholder: string;
    required: boolean;
    value?: any;
}

export interface Form {
    _id?: string;
    name: string;
    description: string;
    tag?: any;
    fields: FormField[];
    createdAt?: string;
    updatedAt?: string;
}
