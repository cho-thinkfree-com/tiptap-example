# Port Allocation Convention

To accommodate ~20 services with dedicated blocks for debug/actuator ports, we use the **97xx - 99xx** range.

## Structure
Format: `9[Category][Service][Type]`

### 1. Category (2nd digit)
- **7**: **Infrastructure** (DB, Redis, MinIO, RabbitMQ) -> `97xx`
- **8**: **Special Services** (AI, Embedding, Reranking) -> `98xx`
- **9**: **Web & API Services** (Frontend, BFF, API Servers) -> `99xx`

### 2. Service Slot (3rd digit)
Each category has 10 slots (0-9).
Example: `970x` (Postgres), `971x` (MinIO).

### 3. Port Type (4th digit)
Standardized offsets for consistency:

| Offset | Type | Description |
| :--- | :--- | :--- |
| **0** | **Main** | Main Service Port (HTTP/TCP) |
| **1** | **Admin/Debug** | Admin Console, Debugger, HMR |
| **2** | **Metrics/Health** | Actuator, Prometheus, Health Check |
| **3** | **Internal** | GRPC, Inter-service communication |
| **9** | **Test** | Reserved for testing |

## Assignments

### Infrastructure (97xx)
| Service | Slot | Main (x0) | Admin/Debug (x1) | Note |
| :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL** | **0** | `9700` | - | |
| **MinIO** | **1** | `9710` (API) | `9711` (Console) | |
| **Redis** | **2** | `9720` | - | Reserved |
| **RabbitMQ** | **3** | `9730` | `9731` (Mgmt) | Reserved |

### Special Services (98xx)
| Service | Slot | Main (x0) | Debug (x1) | Actuator (x2) |
| :--- | :--- | :--- | :--- | :--- |
| **Embedding** | **0** | `9800` | `9801` | `9802` |
| **Reranking** | **1** | `9810` | `9811` | `9812` |

### Web & API Services (99xx)
| Service | Slot | Main (x0) | Debug (x1) | Actuator (x2) |
| :--- | :--- | :--- | :--- | :--- |
| **WWW** | **0** | `9900` | `9901` | `9902` |
| **My** | **1** | `9910` | `9911` | `9912` |
| **API Server** | **2** | `9920` | `9921` | `9922` |
