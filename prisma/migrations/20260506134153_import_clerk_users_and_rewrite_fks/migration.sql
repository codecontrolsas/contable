-- Migración: Importar usuarios de Clerk a Better Auth + reescribir FKs (idempotente)
-- Re-ejecutable: usa ON CONFLICT y JOINs por legacy_clerk_id, sin duplicar.

-- ============================================
-- 1. INSERTAR USUARIOS BA
-- ============================================
INSERT INTO "user" (id, email, email_verified, name, image, created_at, updated_at, first_name, last_name, image_key, image_url, legacy_clerk_id)
VALUES
  (gen_random_uuid(), 'yordanpz+clerk_test@hotmail.com',           true, 'Yordani Testing',     NULL, '2026-01-21T01:12:38Z', NOW(), 'Yordani',   'Testing',  NULL, NULL, 'user_38XttXTm0XNDYKYMkyCUCgSnNjI'),
  (gen_random_uuid(), 'fspiritosi@codecontrol.com.ar',             true, 'Fabricio Spiritosi',  NULL, '2026-01-30T13:42:51Z', NOW(), 'Fabricio',  'Spiritosi',NULL, NULL, 'user_38ynF7pWZoKv2656xio53PsuMyB'),
  (gen_random_uuid(), 'yordani12yorda@gmail.com',                  true, 'Yordani 2 Jimenez 2', NULL, '2026-02-01T04:55:06Z', NOW(), 'Yordani 2', 'Jimenez 2',NULL, NULL, 'user_393PJBcgxiMmU5YW5f8pq7ysJ9e'),
  (gen_random_uuid(), 'fspiritosi+clerk_test@codecontrol.com.ar',  true, 'Fabricio Test',       NULL, '2026-02-19T23:10:21Z', NOW(), 'Fabricio',  'Test',     NULL, NULL, 'user_39uOjCvMT3YtyLB7EpXvosaeCZp'),
  (gen_random_uuid(), 'ventas@codecontrol.com.ar',                 true, 'Ecotest Ecokit',      NULL, '2026-03-18T13:43:12Z', NOW(), 'Ecotest',   'Ecokit',   NULL, NULL, 'user_3B7Y5ZOrDVsaBX61URxmrWtOOzX'),
  (gen_random_uuid(), 'ra@ecokit.com.ar',                          true, 'Rocio Alonso',        NULL, '2026-04-29T11:38:00Z', NOW(), 'Rocio',     'Alonso',   NULL, NULL, 'user_3D1w311vymgayazKMh33xayej7A')
ON CONFLICT (email) DO UPDATE
  SET legacy_clerk_id = EXCLUDED.legacy_clerk_id
  WHERE "user".legacy_clerk_id IS NULL;

-- ============================================
-- 2. INSERTAR ACCOUNTS (credentials con bcrypt)
-- ============================================
INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
SELECT gen_random_uuid(), u.id::text, 'credential', u.id, x.password, NOW(), NOW()
FROM (VALUES
  ('user_38XttXTm0XNDYKYMkyCUCgSnNjI', '$2a$10$vdIVlMxSjttbIkReI9LmMOoEjlbbCNMxAzX3lD3.RDxePIwhbSRZO'),
  ('user_38ynF7pWZoKv2656xio53PsuMyB', '$2a$10$beaRvCIorFRJ9sH9d/B5K.NF/SoeoZY8w45lYOHatXgo20bwoqD0u'),
  ('user_393PJBcgxiMmU5YW5f8pq7ysJ9e', '$2a$10$KvmKezAWFBqNaxO0nXCX4.h9lxqlIkj14CnQXK.PrwAuZZjswc6GC'),
  ('user_39uOjCvMT3YtyLB7EpXvosaeCZp', '$2a$10$fWYD9VZjjUg4aj/mqmJAbuvOOi8gkiEvrHm0Q44HFE9S5ysBzSPfW'),
  ('user_3B7Y5ZOrDVsaBX61URxmrWtOOzX', '$2a$10$QwnUCJPNXRAOdgVsgLq/q.nqwqQx9ob/xIBQn9WgPIuntQpkOkKgS'),
  ('user_3D1w311vymgayazKMh33xayej7A', '$2a$10$2gc/28RT/XLjw3XuBd70ZusWYCmWlky7eKSP1840dU1hvOT6KtriO')
) AS x(clerk_id, password)
JOIN "user" u ON u.legacy_clerk_id = x.clerk_id
WHERE NOT EXISTS (
  SELECT 1 FROM account a
  WHERE a.user_id = u.id AND a.provider_id = 'credential'
);

-- ============================================
-- 3. REESCRIBIR FKs string que guardan Clerk IDs → BA UUID
-- ============================================
-- Pattern: UPDATE <tabla> t SET <col> = u.id::text FROM "user" u WHERE t.<col> = u.legacy_clerk_id;
-- Idempotente: si los valores ya fueron reescritos (o nunca fueron Clerk IDs), el JOIN no matchea.

-- 3.1 company_members.user_id
UPDATE company_members cm SET user_id = u.id::text FROM "user" u WHERE cm.user_id = u.legacy_clerk_id;

-- 3.2 company_members.invited_by
UPDATE company_members cm SET invited_by = u.id::text FROM "user" u WHERE cm.invited_by = u.legacy_clerk_id;

-- 3.3 company_invitations.invited_by
UPDATE company_invitations ci SET invited_by = u.id::text FROM "user" u WHERE ci.invited_by = u.legacy_clerk_id;

-- 3.4 user_preferences.user_id
UPDATE user_preferences up SET user_id = u.id::text FROM "user" u WHERE up.user_id = u.legacy_clerk_id;

-- 3.5 company_member_permissions.assigned_by
UPDATE company_member_permissions cmp SET assigned_by = u.id::text FROM "user" u WHERE cmp.assigned_by = u.legacy_clerk_id;

-- 3.6 permission_audit_logs.performed_by
UPDATE permission_audit_logs pal SET performed_by = u.id::text FROM "user" u WHERE pal.performed_by = u.legacy_clerk_id;

-- 3.7 journal_entries.created_by
UPDATE journal_entries je SET created_by = u.id::text FROM "user" u WHERE je.created_by = u.legacy_clerk_id;

-- 3.8 journal_entries.reversed_by
UPDATE journal_entries je SET reversed_by = u.id::text FROM "user" u WHERE je.reversed_by = u.legacy_clerk_id;

-- 3.9 budgets.created_by
UPDATE budgets b SET created_by = u.id::text FROM "user" u WHERE b.created_by = u.legacy_clerk_id;

-- 3.10 budget_revisions.created_by
UPDATE budget_revisions br SET created_by = u.id::text FROM "user" u WHERE br.created_by = u.legacy_clerk_id;

-- 3.11 quotes.created_by
UPDATE quotes q SET created_by = u.id::text FROM "user" u WHERE q.created_by = u.legacy_clerk_id;

-- 3.12 employee_documents.uploaded_by
UPDATE employee_documents ed SET uploaded_by = u.id::text FROM "user" u WHERE ed.uploaded_by = u.legacy_clerk_id;

-- 3.13 employee_document_history.changed_by
UPDATE employee_document_history edh SET changed_by = u.id::text FROM "user" u WHERE edh.changed_by = u.legacy_clerk_id;

-- 3.14 equipment_documents.uploaded_by
UPDATE equipment_documents eqd SET uploaded_by = u.id::text FROM "user" u WHERE eqd.uploaded_by = u.legacy_clerk_id;

-- 3.15 equipment_documents.approved_by
UPDATE equipment_documents eqd SET approved_by = u.id::text FROM "user" u WHERE eqd.approved_by = u.legacy_clerk_id;

-- 3.16 equipment_document_history.changed_by
UPDATE equipment_document_history eqdh SET changed_by = u.id::text FROM "user" u WHERE eqdh.changed_by = u.legacy_clerk_id;

-- 3.17 company_documents.uploaded_by
UPDATE company_documents cd SET uploaded_by = u.id::text FROM "user" u WHERE cd.uploaded_by = u.legacy_clerk_id;

-- 3.18 company_documents.approved_by
UPDATE company_documents cd SET approved_by = u.id::text FROM "user" u WHERE cd.approved_by = u.legacy_clerk_id;

-- 3.19 suppliers.created_by
UPDATE suppliers s SET created_by = u.id::text FROM "user" u WHERE s.created_by = u.legacy_clerk_id;

-- 3.20 products.created_by
UPDATE products p SET created_by = u.id::text FROM "user" u WHERE p.created_by = u.legacy_clerk_id;

-- 3.21 price_lists.created_by
UPDATE price_lists pl SET created_by = u.id::text FROM "user" u WHERE pl.created_by = u.legacy_clerk_id;

-- 3.22 price_lists.last_modified_by
UPDATE price_lists pl SET last_modified_by = u.id::text FROM "user" u WHERE pl.last_modified_by = u.legacy_clerk_id;

-- 3.23 stock_movements.created_by
UPDATE stock_movements sm SET created_by = u.id::text FROM "user" u WHERE sm.created_by = u.legacy_clerk_id;

-- 3.24 stock_transfers.created_by
UPDATE stock_transfers st SET created_by = u.id::text FROM "user" u WHERE st.created_by = u.legacy_clerk_id;

-- 3.25 sales_points_of_sale.created_by
UPDATE sales_points_of_sale spos SET created_by = u.id::text FROM "user" u WHERE spos.created_by = u.legacy_clerk_id;

-- 3.26 sales_invoices.created_by
UPDATE sales_invoices si SET created_by = u.id::text FROM "user" u WHERE si.created_by = u.legacy_clerk_id;

-- 3.27 purchase_invoices.created_by
UPDATE purchase_invoices pi SET created_by = u.id::text FROM "user" u WHERE pi.created_by = u.legacy_clerk_id;

-- 3.28 cash_registers.created_by
UPDATE cash_registers cr SET created_by = u.id::text FROM "user" u WHERE cr.created_by = u.legacy_clerk_id;

-- 3.29 cash_register_sessions.opened_by
UPDATE cash_register_sessions crs SET opened_by = u.id::text FROM "user" u WHERE crs.opened_by = u.legacy_clerk_id;

-- 3.30 cash_register_sessions.closed_by
UPDATE cash_register_sessions crs SET closed_by = u.id::text FROM "user" u WHERE crs.closed_by = u.legacy_clerk_id;

-- 3.31 cash_movements.created_by
UPDATE cash_movements cm2 SET created_by = u.id::text FROM "user" u WHERE cm2.created_by = u.legacy_clerk_id;

-- 3.32 bank_accounts.created_by
UPDATE bank_accounts ba SET created_by = u.id::text FROM "user" u WHERE ba.created_by = u.legacy_clerk_id;

-- 3.33 bank_movements.created_by
UPDATE bank_movements bm SET created_by = u.id::text FROM "user" u WHERE bm.created_by = u.legacy_clerk_id;

-- 3.34 receipts.created_by
UPDATE receipts r SET created_by = u.id::text FROM "user" u WHERE r.created_by = u.legacy_clerk_id;

-- 3.35 receipts.confirmed_by
UPDATE receipts r SET confirmed_by = u.id::text FROM "user" u WHERE r.confirmed_by = u.legacy_clerk_id;

-- 3.36 payment_orders.created_by
UPDATE payment_orders po SET created_by = u.id::text FROM "user" u WHERE po.created_by = u.legacy_clerk_id;

-- 3.37 payment_orders.confirmed_by
UPDATE payment_orders po SET confirmed_by = u.id::text FROM "user" u WHERE po.confirmed_by = u.legacy_clerk_id;

-- 3.38 recurring_entries.created_by
UPDATE recurring_entries re SET created_by = u.id::text FROM "user" u WHERE re.created_by = u.legacy_clerk_id;

-- 3.39 expenses.created_by
UPDATE expenses e SET created_by = u.id::text FROM "user" u WHERE e.created_by = u.legacy_clerk_id;

-- 3.40 purchase_orders.approved_by
UPDATE purchase_orders po2 SET approved_by = u.id::text FROM "user" u WHERE po2.approved_by = u.legacy_clerk_id;

-- 3.41 purchase_orders.created_by
UPDATE purchase_orders po2 SET created_by = u.id::text FROM "user" u WHERE po2.created_by = u.legacy_clerk_id;

-- 3.42 receiving_notes.created_by
UPDATE receiving_notes rn SET created_by = u.id::text FROM "user" u WHERE rn.created_by = u.legacy_clerk_id;

-- 3.43 delivery_notes.created_by
UPDATE delivery_notes dn SET created_by = u.id::text FROM "user" u WHERE dn.created_by = u.legacy_clerk_id;

-- 3.44 checks.created_by
UPDATE checks c SET created_by = u.id::text FROM "user" u WHERE c.created_by = u.legacy_clerk_id;

-- 3.45 cashflow_projections.created_by
UPDATE cashflow_projections cp SET created_by = u.id::text FROM "user" u WHERE cp.created_by = u.legacy_clerk_id;

-- 3.46 projection_document_links.created_by
UPDATE projection_document_links pdl SET created_by = u.id::text FROM "user" u WHERE pdl.created_by = u.legacy_clerk_id;

-- 3.47 vehicle_depreciations.created_by
UPDATE vehicle_depreciations vd SET created_by = u.id::text FROM "user" u WHERE vd.created_by = u.legacy_clerk_id;

-- 3.48 depreciation_schedule_entries.posted_by
UPDATE depreciation_schedule_entries dse SET posted_by = u.id::text FROM "user" u WHERE dse.posted_by = u.legacy_clerk_id;

-- 3.49 asset_value_adjustments.created_by
UPDATE asset_value_adjustments ava SET created_by = u.id::text FROM "user" u WHERE ava.created_by = u.legacy_clerk_id;
