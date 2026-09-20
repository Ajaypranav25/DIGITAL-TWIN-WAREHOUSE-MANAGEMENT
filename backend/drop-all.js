const { Client } = require('pg');

const client = new Client({
  host: 'localhost', port: 5432,
  user: 'postgres', password: 'postgres',
  database: 'digital_twin_wms'
});

const drops = [
  'DROP TABLE IF EXISTS DigitalTwinSnapshot CASCADE',
  'DROP TABLE IF EXISTS Shipment CASCADE',
  'DROP TABLE IF EXISTS OrderItem CASCADE',
  'DROP TABLE IF EXISTS "Order" CASCADE',
  'DROP TABLE IF EXISTS Alert CASCADE',
  'DROP TABLE IF EXISTS SensorReading CASCADE',
  'DROP TABLE IF EXISTS Sensor CASCADE',
  'DROP TABLE IF EXISTS Equipment CASCADE',
  'DROP TABLE IF EXISTS Employee CASCADE',
  'DROP TABLE IF EXISTS InventoryItem CASCADE',
  'DROP TABLE IF EXISTS Bin CASCADE',
  'DROP TABLE IF EXISTS Rack CASCADE',
  'DROP TABLE IF EXISTS Zone CASCADE',
  'DROP TABLE IF EXISTS Product CASCADE',
  'DROP TABLE IF EXISTS Warehouse CASCADE',
  'DROP VIEW IF EXISTS vw_live_digital_twin_state CASCADE',
  'DROP VIEW IF EXISTS vw_alert_anomaly_report CASCADE',
  'DROP VIEW IF EXISTS vw_inventory_utilisation CASCADE',
  'DROP FUNCTION IF EXISTS fn_sync_bin_stock() CASCADE',
  'DROP FUNCTION IF EXISTS fn_check_sensor_threshold() CASCADE',
  'DROP PROCEDURE IF EXISTS sp_fulfil_order(INT) CASCADE',
  'DROP PROCEDURE IF EXISTS sp_take_snapshot(INT) CASCADE',
];

client.connect()
  .then(async () => {
    await client.query("SET client_encoding = 'UTF8'");
    for (const d of drops) {
      try { await client.query(d); } catch (e) { /* ignore */ }
    }
    console.log('All DB objects dropped. Ready for fresh setup.');
    await client.end();
  })
  .catch(e => { console.error(e.message); process.exit(1); });
