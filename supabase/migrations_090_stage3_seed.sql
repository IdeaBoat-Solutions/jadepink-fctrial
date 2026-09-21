
-- JadePink Store OS — 090 Stage 3: seed drop reasons
-- Run AFTER 080 in SQL Editor.
-- Idempotent: uses INSERT ... ON CONFLICT DO NOTHING.

insert into public.drop_reasons (id, code, label, description, sort_order)
values
  ('drop-size',       'SIZE',        'Size',        'The fit or cut was not the right size',                 10),
  ('drop-fit',        'FIT',         'Fit',         'The overall fit did not suit the customer',              20),
  ('drop-colour',     'COLOUR',      'Colour',      'The colour was not quite right',                         30),
  ('drop-design',     'DESIGN',      'Design',      'The design or style was not preferred',                  40),
  ('drop-material',   'MATERIAL',    'Material',    'The fabric or material was not suitable',                50),
  ('drop-price',      'PRICE',       'Price',       'The price point did not work for the customer',          60),
  ('drop-style',      'STYLE',       'Style',       'The overall style was not right for the occasion',       70),
  ('drop-not-suitable','NOT_SUITABLE','Did not suit', 'The product did not suit the customer overall',         80),
  ('drop-other',      'OTHER',       'Other',       'Another reason not listed above. Add a note if needed.', 90)
on conflict (id) do nothing;

-- Also upsert by code to handle re-runs where IDs might differ
insert into public.drop_reasons (code, label, description, sort_order)
values
  ('SIZE',        'Size',        'The fit or cut was not the right size',                 10),
  ('FIT',         'Fit',         'The overall fit did not suit the customer',              20),
  ('COLOUR',      'Colour',      'The colour was not quite right',                         30),
  ('DESIGN',      'Design',      'The design or style was not preferred',                  40),
  ('MATERIAL',    'Material',    'The fabric or material was not suitable',                50),
  ('PRICE',       'Price',       'The price point did not work for the customer',          60),
  ('STYLE',       'Style',       'The overall style was not right for the occasion',       70),
  ('NOT_SUITABLE','Did not suit', 'The product did not suit the customer overall',         80),
  ('OTHER',       'Other',       'Another reason not listed above. Add a note if needed.', 90)
on conflict (code) do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;
