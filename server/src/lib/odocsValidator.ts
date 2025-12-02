// Backend validation utility for .odocs file format

export interface OdocsValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Validates TipTap document structure on backend
 */
export function validateOdocsContent(content: any): OdocsValidationResult {
    // Must be an object
    if (typeof content !== 'object' || content === null || Array.isArray(content)) {
        return {
            valid: false,
            error: 'Document must be a JSON object',
        };
    }

    // Must have type: 'doc'
    if (content.type !== 'doc') {
        return {
            valid: false,
            error: 'Document must have type: "doc"',
        };
    }

    // Must have content array
    if (!Array.isArray(content.content)) {
        return {
            valid: false,
            error: 'Document must have a content array',
        };
    }

    // Validate content nodes
    for (let i = 0; i < content.content.length; i++) {
        const node = content.content[i];

        if (typeof node !== 'object' || node === null) {
            return {
                valid: false,
                error: `Content node at index ${i} must be an object`,
            };
        }

        if (typeof node.type !== 'string') {
            return {
                valid: false,
                error: `Content node at index ${i} must have a type`,
            };
        }
    }

    return {
        valid: true,
    };
}
