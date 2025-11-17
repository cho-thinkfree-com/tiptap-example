# Step S4 – Workspace Creation Basics

Milestone B1 enables workspace CRUD shell for owners.

## Endpoints
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/workspaces` | Create a workspace; creator becomes owner. |
| `GET` | `/api/workspaces` | List workspaces owned by the account (B1 scope). |
| `GET` | `/api/workspaces/{id}` | Fetch workspace metadata. |

## Schema summary
```yaml
components:
  schemas:
    WorkspaceResponse:
      type: object
      properties:
        id: { type: string, format: uuid }
        name: { type: string }
        slug: { type: string }
        description: { type: string, nullable: true }
        coverImage: { type: string, format: uri, nullable: true }
        defaultLocale: { type: string }
        visibility: { type: string, enum: [private, listed, public], default: private }
        createdAt: { type: string, format: date-time }
        updatedAt: { type: string, format: date-time }
paths:
  /api/workspaces:
    post:
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name]
              properties:
                name: { type: string, minLength: 1, maxLength: 80 }
                description: { type: string, maxLength: 2000 }
                coverImage: { type: string, format: uri }
                defaultLocale: { type: string }
                visibility: { type: string, enum: [private, listed, public] }
      responses:
        '201':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/WorkspaceResponse'
        '422': { description: Validation error }
    get:
      summary: List owned workspaces
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  items:
                    type: array
                    items:
                      $ref: '#/components/schemas/WorkspaceResponse'
  /api/workspaces/{id}:
    get:
      responses:
        '200': { $ref: '#/components/schemas/WorkspaceResponse' }
        '404': { description: Not found }
```

## Rules
- Slug generated from name, unique globally (append random suffix on collisions).
- Only owner can read/list in B1, so `GET /api/workspaces` uses authenticated account.
- Soft delete field exists but delete endpoint deferred to B2.

## Tests
- Creating workspace returns slug + timestamps, owner stored.
- Listing returns only owner-created workspaces.
- Duplicate names yield unique slugs.
