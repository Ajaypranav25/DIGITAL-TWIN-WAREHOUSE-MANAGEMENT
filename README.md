# Digital Twin Warehouse Management System
### Academic Database Project — PostgreSQL

---

## Project Overview

A **database-driven digital twin** that continuously ingests physical warehouse events (RFID, temperature, bin weights), transactional orders, and layout hierarchies to maintain a live, synchronized digital state with full historical snapshot capability.

### Key Characteristics
- **Hierarchy:** Warehouse → Zone → Rack → Bin
- **Live State:** Real-time stock via `InventoryItem`, sensor feeds via `SensorReading`
- **Anomaly Detection:** Trigger-driven `Alert` generation
- **Time-Travel:** `DigitalTwinSnapshot` table for historical reconstruction
- **Normalization:** Strict 3NF throughout all 15 tables

---

## Repository Structure

| File | Purpose |
|---|---|
| [`01_ddl_schema.sql`](01_ddl_schema.sql) | Schema DDL — all 15 tables with PK/FK/CHECK constraints |
| [`02_seed_data.sql`](02_seed_data.sql) | Seed data — 3 warehouses, 8 zones, 20 racks, 39 bins, 22 products, 20 sensors, 12 orders |
| [`03_triggers_procedures.sql`](03_triggers_procedures.sql) | Triggers, stored procedures, transaction demo |
| [`04_views_queries.sql`](04_views_queries.sql) | 3 analytical views + 8 ad-hoc queries |

---

## Entity–Relationship Summary

```
Warehouse (1) ─────< Zone (M) ─────< Rack (M) ─────< Bin (M)
                       │                                  │
                       │                                  M
                       │                            InventoryItem
                       │                                  M
                       │                                  │
                       │                             Product (1)
                       │
                       ├──< Sensor (M) ──────< SensorReading (M)
                       │       └───────────────────> Alert
                       │
                       ├──< Alert (M)
                       ├──< Employee (M)
                       └──< Equipment (M)

Order (1) ─────< OrderItem (M) ──── Product (1)
  └──── Shipment (1:1)

Warehouse (1) ──< DigitalTwinSnapshot (M)
```

---

## Setup & Execution (PostgreSQL)

### Prerequisites
- PostgreSQL 14 or later
- `psql` client or any compatible GUI (pgAdmin, DBeaver, TablePlus)

### Quick start (no PostgreSQL install needed)

```bash
cd backend && npm install && npm run dev:embed   # embedded PostgreSQL + API on :3001
cd frontend && npm install && npm run dev        # UI on http://localhost:5173
cd backend && node setup-db.js                   # reset to the clean seed data
cd backend && npm test                           # 25 tests (server must be running)
```

### Step-by-Step Execution (your own PostgreSQL)

```bash
# 1. Create a fresh database
createdb digital_twin_wms

# 2. Connect and run scripts in order
psql -d digital_twin_wms -f 01_ddl_schema.sql
psql -d digital_twin_wms -f 02_seed_data.sql
psql -d digital_twin_wms -f 03_triggers_procedures.sql
psql -d digital_twin_wms -f 04_views_queries.sql
```

Or in a single psql session:
```sql
\i 01_ddl_schema.sql
\i 02_seed_data.sql
\i 03_triggers_procedures.sql
\i 04_views_queries.sql
```

---

## Key Database Features Demonstrated

### 1. Triggers

| Trigger | Table | Event | Purpose |
|---|---|---|---|
| `trg_bin_stock_sync` | `InventoryItem` | `AFTER INSERT/UPDATE/DELETE` | Recalculates `Bin.CurrentStock`; rejects overfill; raises Overstocked alert at 100% fill and auto-resolves it when space frees up |
| `trg_sensor_threshold_check` | `SensorReading` | `AFTER INSERT` | Raises Threshold Breach alert when sensor exceeds `ThresholdMin`/`ThresholdMax` |
| `trg_sensor_failure_alert` | `Sensor` | `AFTER UPDATE OF Status` | Raises a Sensor Failure alert when a sensor becomes `Faulty` |

### 2. Stored Procedures

| Procedure | Purpose |
|---|---|
| `sp_fulfil_order(order_id)` | Atomic order fulfilment — decrements stock across bins (FIFO: oldest stock first), updates Order status, creates Shipment. Full ROLLBACK on failure. |
| `sp_take_snapshot(warehouse_id)` | Captures a `DigitalTwinSnapshot` with live metrics and JSONB payload |

### 3. Views

| View | Purpose |
|---|---|
| `vw_live_digital_twin_state` | Full hierarchy with occupancy % and latest sensor readings |
| `vw_alert_anomaly_report` | Unresolved alerts grouped by zone and severity |
| `vw_inventory_utilisation` | Bin fill rates per warehouse/zone with health labels |

---

## Quick Demo Queries

```sql
-- Live warehouse state (digital twin surface)
SELECT WarehouseName, ZoneName, RackCode, BinCode,
       ProductName, BinCurrentStock, BinMaxCapacity,
       BinUtilisationPct, BinOccupancyStatus
FROM vw_live_digital_twin_state;

-- Unresolved critical alerts
SELECT * FROM vw_alert_anomaly_report WHERE Severity = 'Critical';

-- Bin utilisation by zone
SELECT * FROM vw_inventory_utilisation ORDER BY UtilisationPct DESC;

-- Fulfil an order (triggers stock deduction + shipment creation)
CALL sp_fulfil_order(6);   -- succeeds, FIFO across two bins
CALL sp_fulfil_order(8);   -- fails: insufficient stock, fully rolled back

-- Take a warehouse snapshot for time-travel
CALL sp_take_snapshot(1);
```

---

## Design Decisions

| Decision | Rationale |
|---|---|
| `InventoryItem` associative entity | Resolves M:N between Bin and Product; `Quantity` depends on both keys |
| `OrderItem` associative entity | Resolves M:N between Order and Product; captures `UnitPriceAtSale` at time of sale |
| Separate `Sensor` and `SensorReading` | Prevents insert/delete/update anomalies; satisfies 3NF |
| `Bin.CurrentStock` denormalization | Controlled redundancy maintained by trigger; avoids expensive SUM on every read |
| `DigitalTwinSnapshot.SnapshotPayloadJSON` (JSONB) | Schema-flexible payload supporting full state replay for time-travel |
| `TIMESTAMPTZ` for all timestamps | UTC-normalized storage prevents timezone/DST data corruption |
| `FOR UPDATE SKIP LOCKED` in `sp_fulfil_order` | Concurrency-safe stock deduction; no double-decrement under parallel orders |

---

## Normalization Summary

All 15 tables strictly adhere to **Third Normal Form (3NF)**:
- **1NF:** Atomic values, no repeating groups, single-valued columns
- **2NF:** Every non-key attribute is fully functionally dependent on the entire primary key
- **3NF:** No transitive dependencies — non-key attributes depend only on the PK, not on other non-key attributes


---

## Academic Context

This project is submitted as a Database Management Systems coursework demonstrating:
- Clean relational schema design
- Third Normal Form normalization
- Transactional integrity (ACID properties)
- Advanced DBMS objects (triggers, stored procedures, views)
- Digital Twin architectural principles

---

*Digital Twin Warehouse Management System — Academic Project*
