-- Новые награды «Друзей» для базы, где referral.sql уже выполнен (ref_cfg он не перезаписывает). Выполнить один раз, затем media.sql.
update public.ref_cfg set val = '{"rub": 500000, "luck": 30, "items": ["ref_t_invited"]}' where key = 'welcome';
update public.ref_cfg set val = '{"rub": 200000, "luck": 10}'  where key = 'rew_stage1';
update public.ref_cfg set val = '{"rub": 1000000, "luck": 30}' where key = 'rew_stage2';
update public.ref_cfg set val = '{"rub": 1500000}' where key = 'rew_stage2_ref';
update public.ref_cfg set val = '{"rub": 2000000, "luck": 50}' where key = 'rew_stage3';
update public.ref_cfg set val = '2000000000' where key = 'day_budget_rub';
update public.ref_cfg set val = '30000000'   where key = 'player_cap_rub';
update public.ref_cfg set val = '10000000'   where key = 'ring_rub';
update public.ref_cfg set val = '[{"rub": 20000000, "luck": 100, "plate": "friends", "rare": true}, {"rub": 10000000, "luck": 50}, {"rub": 5000000, "luck": 25}]' where key = 'week_prizes';
update public.ref_ladder set reward = '{"rub": 1000000, "luck": 20}' where n = 1;
update public.ref_ladder set reward = '{"items": ["ref_f_own"], "luck": 30}' where n = 3;
update public.ref_ladder set reward = '{"rub": 5000000, "luck": 50}' where n = 5;
update public.ref_ladder set reward = '{"rub": 10000000, "plate": "friends"}' where n = 25;
update public.ref_ladder set reward = '{"rub": 50000000, "luck": 200, "items": ["ref_d_column"]}' where n = 50;
update public.ref_ladder set reward = '{"rub": 100000000, "plate": "friends", "rare": true, "items": ["ref_t_leader"]}' where n = 100;
update public.ref_ladder set reward = '{"rub": 250000000, "plate": "friends", "rare": true}', title = 'Редкий номер серии и 250 млн' where n = 250;
