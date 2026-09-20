# Academic Viva Preparation Guide
## Digital Twin Warehouse Management System

> **Exam Context:** Database Design (3NF), Advanced DBMS Features, Transactional Integrity, Digital Twin Architecture.

---

## Part 1 — Relational Design & Normalization

### 1.1 Why Associative Entities Are Essential

#### InventoryItem (Bin ↔ Product)

**The Problem:**
In the real world, a single bin can hold multiple types of products, and a single product can be stored across many bins. This is a **many-to-many (M:N) relationship**. Relational databases cannot directly represent M:N relationships without violating normalization rules.

**Without an associative entity, you would need to either:**
- Add multiple product columns in `Bin` (`Product1ID`, `Product1Qty`, `Product2ID`…) — violating **1NF** (repeating groups)
- Add multiple bin columns in `Product` — same problem

**The Solution — InventoryItem:**
```
Bin (BinID, BinCode, Capacity, CurrentStock, ...)
         │ 1
         │
         ▼ M
InventoryItem (InventoryItemID, BinID [FK], ProductID [FK], Quantity, LastUpdated)
         ▲ M
         │
         │ 1
Product  (ProductID, SKU, ProductName, ...)
```

`InventoryItem` holds **both** foreign keys (`BinID`, `ProductID`) as its composite candidate key, plus its own descriptive attribute `Quantity`. This attribute **depends on the combination** of both keys — "how many units of *this product* are in *this bin*?" — which is precisely the semantics of a bridge/associative entity.

> **Key Viva Point:** `Quantity` cannot belong to `Bin` alone (which product?) or `Product` alone (which bin?). It belongs to the intersection — the associative entity. This is the textbook justification for a bridge table.

---

#### OrderItem (Order ↔ Product)

**The Problem:**
A single order can contain multiple products (line items), and a single product can appear in many orders over time — another M:N relationship.

**The Solution — OrderItem:**
```
Order (OrderID, CustomerName, Status, TotalAmount, ...)
          │ 1
          │
          ▼ M
OrderItem (OrderItemID, OrderID [FK], ProductID [FK], Quantity, UnitPriceAtSale)
          ▲ M
          │
          │ 1
Product   (ProductID, SKU, ProductName, UnitPrice, ...)
```

`UnitPriceAtSale` is a **historically significant attribute** — the price captured at the time the order was placed. It cannot be stored in `Product` (current price changes) or in `Order` (which product?). It only makes sense on the bridge row.

> **Key Viva Point:** Attributes that describe the *relationship* rather than either entity alone must live in the associative entity. `UnitPriceAtSale` and `Quantity` are classic examples.

---

### 1.2 Third Normal Form (3NF) Compliance

#### Definitions Recap
| Normal Form | Requirement |
|---|---|
| **1NF** | Atomic values; no repeating groups; each column holds a single value |
| **2NF** | 1NF + every non-key attribute is **fully functionally dependent** on the entire primary key |
| **3NF** | 2NF + no non-key attribute is **transitively dependent** on the primary key via another non-key attribute |

#### How Every Table Satisfies 3NF

**Warehouse**
- PK: `WarehouseID` (SERIAL)
- Non-key: `Name`, `Location`, `TotalCapacity`, `ManagerName`, `CreatedAt`
- Dependency: All attributes describe the warehouse directly. `ManagerName` could theoretically create a transitive dependency if managers had their own table — but in scope, it is treated as a denormalized string (like a contact field). If managers were entities, they'd become `Employee`.
- ✅ 3NF satisfied.

**Zone**
- PK: `ZoneID`; FK: `WarehouseID`
- Non-key: `ZoneName`, `ZoneType`, `FloorArea_sqm`
- All attributes describe the zone, not the warehouse. `WarehouseID` is the FK, not a descriptor.
- ✅ 3NF satisfied.

**Rack → Bin → InventoryItem chain**
- Each table's non-key attributes depend solely on that table's own PK.
- `RackCode` depends on `RackID`, not `ZoneID` (which is the FK).
- `BinCode` and `Capacity` depend on `BinID`, not `RackID`.
- ✅ No transitive dependencies.

**SensorReading (critically important for 3NF defense)**
- PK: `ReadingID`
- Non-key: `SensorID (FK)`, `ReadingValue`, `Unit`, `RecordedAt`
- `ReadingValue` depends on *this specific reading*, not just the sensor.
- Sensor metadata (type, thresholds) lives in `Sensor`, not here.
- ✅ 3NF: no transitive chain through `SensorID`.

---

### 1.3 Why Separating Sensor from SensorReading Prevents Anomalies

This is the **most important normalization argument** in the schema:

#### What Would Happen if They Were One Table?

Imagine a single `SensorLog` table:
```
SensorLog(ReadingID, SensorType, Model, ZoneID, ThresholdMax, ReadingValue, RecordedAt)
```

**Insertion Anomaly:**
You cannot record that a new sensor has been installed until it sends its first reading. Before the first reading, the sensor's metadata (type, model, zone) has nowhere to live.

**Deletion Anomaly:**
If you delete all readings for a sensor (e.g., purge old data), you also lose the sensor's existence, type, model, and configuration — even though the physical sensor is still installed.

**Update Anomaly:**
If the threshold for a temperature sensor changes from 25°C to 28°C, you must update *every row* in `SensorLog` for that sensor. Miss one row and the data is inconsistent.

#### The Correct Design (our schema):

```
Sensor (SensorID, ZoneID, SensorType, Model, ThresholdMin, ThresholdMax, Status)
              │  1
              │
              ▼  M
SensorReading (ReadingID, SensorID [FK], ReadingValue, Unit, RecordedAt)
```

- `Sensor` is the **master/reference** entity — stable configuration data.
- `SensorReading` is the **fact/event** entity — high-frequency, append-only time-series.
- Changing a threshold? Update **one row** in `Sensor`.
- Decommissioning a sensor? Mark `Sensor.Status = 'Inactive'` — all readings remain intact for historical analysis.
- Adding a new sensor before it starts reading? Just insert into `Sensor`.

> **Key Viva Quote:** *"Sensor and SensorReading are separated on the master-detail principle. Sensor holds slowly-changing configuration; SensorReading holds rapidly-changing observations. This separation satisfies 3NF by ensuring every reading's non-key attributes depend only on ReadingID, not on any sensor metadata."*

---

## Part 2 — Digital Twin Architecture

### 2.1 How DigitalTwinSnapshot Enables Time-Travel

A **digital twin** is more than a live dashboard — a defining characteristic is the ability to **reconstruct any past state** of the physical system. This is what separates a digital twin from a live monitoring system.

#### The Problem Without Snapshots:
- Live tables (`Bin.CurrentStock`, `InventoryItem.Quantity`) are **overwritten** with each update.
- You can answer "what is the stock now?" but not "what was the stock at 3 AM last Tuesday?"
- `SensorReading` gives time-series for sensor values but not total warehouse state.

#### How DigitalTwinSnapshot Solves It:

```sql
DigitalTwinSnapshot(
    SnapshotID,
    WarehouseID,        -- which warehouse
    SnapshotTime,       -- TIMESTAMPTZ — the "rewind point"
    TotalBins,
    OccupiedBins,
    TotalStockUnits,    -- aggregate stock at that moment
    ActiveAlerts,
    ActiveSensors,
    SnapshotPayloadJSON -- JSONB: full bin-by-bin breakdown for replay
)
```

**Time-Travel Query Pattern:**
```sql
-- "What was the state of Warehouse 1 at midnight yesterday?"
SELECT * FROM DigitalTwinSnapshot
WHERE WarehouseID = 1
  AND SnapshotTime <= '2026-09-19 00:00:00+05:30'
ORDER BY SnapshotTime DESC
LIMIT 1;
```

**The `SnapshotPayloadJSON` column** stores the full bin-level breakdown as a JSONB blob. This means you can not only get aggregate numbers but also "replay" which bins held what products at any past snapshot point — the hallmark of true time-travel.

> **Key Viva Quote:** *"DigitalTwinSnapshot decouples observability from mutability. Live tables are updated continuously; snapshots are append-only point-in-time captures. Together they give us both real-time accuracy and historical reconstructability — the two pillars of a genuine digital twin."*

#### Additional Time-Series Support:
- `SensorReading` provides **per-sensor time-series** (fine-grained, continuous).
- `Alert` with `RaisedAt`/`ResolvedAt` gives **event history**.
- `DigitalTwinSnapshot` gives **periodic holistic state captures**.

These three layers together form a complete temporal record.

---

## Part 3 — Trigger & Transaction Design

### 3.1 Trigger Architecture

#### Trigger 1: `trg_bin_stock_sync` (Bin Capacity Management)

| Property | Detail |
|---|---|
| **Event** | `AFTER INSERT OR UPDATE` on `InventoryItem` |
| **Scope** | `FOR EACH ROW` |
| **Function** | `fn_sync_bin_stock()` |

**Why AFTER, not BEFORE?**
The trigger uses `SUM(Quantity)` from all `InventoryItem` rows for a bin. An `AFTER` trigger sees the committed new/updated row in the table, giving the correct aggregate. A `BEFORE` trigger would see the pre-change state.

**Why not a CHECK constraint on Bin?**
`Bin.CurrentStock` is derived from the sum of `InventoryItem.Quantity`. A simple `CHECK` on `Bin` cannot enforce this cross-table aggregate — only a trigger can recompute and enforce it.

#### Trigger 2: `trg_sensor_threshold_check` (Anomaly Detection)

| Property | Detail |
|---|---|
| **Event** | `AFTER INSERT` on `SensorReading` |
| **Scope** | `FOR EACH ROW` |
| **Function** | `fn_check_sensor_threshold()` |

The trigger reads `ThresholdMin`/`ThresholdMax` from `Sensor` and compares with the new `ReadingValue`. This implements the **reactive event processing** layer of the digital twin at the database level, ensuring alerts are generated regardless of which application layer inserted the reading.

---

### 3.2 Transaction Design — Order Fulfilment

The `sp_fulfil_order` procedure demonstrates **ACID compliance**:

| ACID Property | How It's Achieved |
|---|---|
| **Atomicity** | All stock decrements, status update, and shipment creation happen in one unit. Any `RAISE EXCEPTION` causes PostgreSQL to roll back the entire transaction. |
| **Consistency** | CHECK constraints on `Bin.CurrentStock ≥ 0`, `InventoryItem.Quantity ≥ 0`, and the `Order.Status` CHECK enum prevent invalid states. |
| **Isolation** | `FOR UPDATE SKIP LOCKED` on `InventoryItem` prevents two concurrent fulfilment calls from double-decrementing the same bin stock. |
| **Durability** | PostgreSQL's WAL (Write-Ahead Logging) ensures committed transactions survive crashes. |

**ROLLBACK Scenario:**
If Order #3 requests 50 units of Peas but only 83 exist (48 + 35 = 83, all in cold storage), and a concurrent fulfilment already took 40 units → only 43 remain → `v_remaining = 7 > 0` → `RAISE EXCEPTION` → entire transaction rolled back → no partial stock deduction.

---

## Part 4 — Entity Relationship Design Decisions

### 4.1 Why `Alert.ZoneID`, `Alert.SensorID`, and `Alert.BinID` Are All Nullable

An alert can originate from:
- A **sensor breach** → `SensorID` is set; `BinID` may be null
- A **bin overflow** → `BinID` is set; `SensorID` is null
- A **zone-level event** → only `ZoneID` is set

Making all three nullable with the constraint that at least one should be set reflects the **optional participation** of each entity in an alert event. This avoids creating separate alert tables for each alert type (which would violate the DRY principle and complicate queries).

### 4.2 Why `Shipment` Has a UNIQUE Constraint on `OrderID`

A 1:1 relationship between `Order` and `Shipment` is enforced by `UNIQUE (OrderID)` in `Shipment`. In this domain, each fulfilled order results in exactly one physical dispatch. If partial shipments were needed, the design would split `Shipment` into a header + `ShipmentItem` bridge.

### 4.3 Why `DigitalTwinSnapshot.SnapshotPayloadJSON` Uses JSONB

- **JSONB** (binary JSON) in PostgreSQL is indexed, compressed, and supports GIN index-based queries.
- The payload structure varies per snapshot (number of bins may change as the warehouse grows), making a schemaless format ideal.
- JSONB allows `@>` containment queries: `SnapshotPayloadJSON @> '[{"BinID": 5}]'` to find all snapshots containing a specific bin.

---

## Part 5 — Expected Viva Questions & Model Answers

### Q1: "What is a digital twin, and how does your database support it?"
**A:** A digital twin is a continuously synchronized virtual representation of a physical system. Our database supports it through: (1) real-time sensor ingestion via `SensorReading`, (2) live inventory tracking via `InventoryItem` and `Bin.CurrentStock`, (3) automated anomaly detection via triggers writing to `Alert`, and (4) historical reconstruction via `DigitalTwinSnapshot` with JSONB payloads.

### Q2: "Explain the hierarchy in your schema."
**A:** Warehouse → Zone → Rack → Bin is a four-level containment hierarchy. Each level holds a foreign key to its parent (e.g., `Zone.WarehouseID`, `Rack.ZoneID`). `ON DELETE CASCADE` propagates deletions downward — deleting a warehouse removes all its zones, racks, and bins automatically.

### Q3: "Why didn't you put the sensor's threshold directly in SensorReading?"
**A:** That would violate 3NF. `ThresholdMax` would transitively depend on `ReadingID` through `SensorID` — if I know `SensorID`, I already know the threshold. Moving thresholds to the `Sensor` master record eliminates this transitive dependency and prevents the update anomaly where changing a threshold requires updating thousands of reading rows.

### Q4: "What happens if a concurrent transaction tries to fulfil the same order?"
**A:** The `SELECT ... FOR UPDATE` lock in `sp_fulfil_order` ensures that the first transaction locks the `Order` row. The second transaction waits. On commit of the first, the second sees `Status = 'Fulfilled'` and raises an exception immediately, preventing double-fulfilment.

### Q5: "Is Bin.CurrentStock a violation of 3NF since it's derivable?"
**A:** This is an intentional **controlled redundancy** (a common optimization). `CurrentStock` is a denormalized aggregate cached at the bin level to support fast capacity checks without summing `InventoryItem.Quantity` on every read. The `trg_bin_stock_sync` trigger keeps it synchronized automatically, making it a **maintained derived attribute** rather than an anomaly.

### Q6: "How would you extend this schema for predictive analytics?"
**A:** Add a `SensorAnomalyML` table to store model predictions alongside actual readings. Add a `MaintenanceSchedule` table linked to `Equipment` for predictive maintenance tracking. The `DigitalTwinSnapshot.SnapshotPayloadJSON` could be enriched with predicted future states from ML models, enabling simulation of layout changes or demand scenarios — the next evolution of the digital twin.

### Q7: "What is the purpose of the UNIQUE constraint on (BinID, ProductID) in InventoryItem?"
**A:** It enforces the business rule that each product can appear at most once per bin. Without it, you could insert two rows for the same product in the same bin, causing incorrect stock totals and making aggregation ambiguous. The trigger then correctly sums all `Quantity` rows per bin.

### Q8: "Why use TIMESTAMPTZ instead of TIMESTAMP?"
**A:** `TIMESTAMPTZ` (timestamp with time zone) stores values in UTC internally and converts to the session's timezone for display. This prevents data corruption when the warehouse operates across time zones or when daylight-saving-time transitions occur — a critical requirement for audit trails and sensor time-series accuracy.

---

## Part 6 — Schema Diagram (Text Format)

```
Warehouse (1) ──────< Zone (M) ──────< Rack (M) ──────< Bin (M)
                        │                                   │
                        │                                   M
                        │                             InventoryItem
                        │                                   M
                        │                                   │
                        │                              Product (1)
                        │
                        ├──< Sensor (M) ──────< SensorReading (M)
                        │       └──────────────────> Alert
                        │
                        ├──< Alert (M)  [also from Bin]
                        ├──< Employee (M)
                        └──< Equipment (M)

Order (1) ──────< OrderItem (M) ──── Product (1)
  └──── Shipment (1:1)

Warehouse (1) ──< DigitalTwinSnapshot (M)
```

---

*End of Viva Preparation Guide*
