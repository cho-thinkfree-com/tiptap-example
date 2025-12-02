// Validation utility for .odocs file format
// .odocs files are TipTap JSON documents

export interface OdocsValidationResult {
    valid: boolean;
    error?: string;
    content?: any;
}

/**
 * Validates that a file is a valid .odocs format
 * .odocs files must be valid JSON with a TipTap document structure
 */
export async function validateOdocsFile(file: File): Promise<OdocsValidationResult> {
    // Check file extension
    if (!file.name.endsWith('.odocs')) {
        return {
            valid: false,
            error: 'File must have .odocs extension',
        };
    }

    try {
        // Read file content
        const text = await file.text();

        // Parse JSON
        let content: any;
        try {
            content = JSON.parse(text);
        } catch (e) {
            return {
                valid: false,
                error: 'File is not valid JSON',
            };
        }

        // Validate TipTap document structure
        const validation = validateTipTapDocument(content);
        if (!validation.valid) {
            return validation;
        }

        return {
            valid: true,
            content,
        };
    } catch (error) {
        return {
            valid: false,
            error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

/**
 * Validates TipTap document structure
 */
function validateTipTapDocument(content: any): OdocsValidationResult {
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
        content,
    };
}

/**
 * Validates odocs content on backend (same validation logic)
 */
export function validateOdocsContent(content: any): { valid: boolean; error?: string } {
    return validateTipTapDocument(content);
}
