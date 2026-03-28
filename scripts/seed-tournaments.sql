-- Seed script for tournament testing.
-- Run directly in the Supabase SQL editor.
-- Creates: fake users, events, 7 days of tournaments, scramble sets,
-- tournament entries, and solves with various edge cases.

-- ============================================================
-- 1. Create fake users (use existing real users + add test users)
-- ============================================================
-- These use fake supabaseIds since they won't actually log in.
INSERT INTO "User" (id, "supabaseId", username, "firstName", "lastName", country, bio, "createdAt", "updatedAt")
VALUES
  ('usr_cube01', 'sb_fake_01', 'cubegod99',      'Max',    'Chen',     'US', 'Sub-8 3x3 avg', NOW(), NOW()),
  ('usr_cube02', 'sb_fake_02', 'speedyfingers',  'Yuki',   'Tanaka',   'JP', '2x2 main',      NOW(), NOW()),
  ('usr_cube03', 'sb_fake_03', 'cubemaster',     'Lukas',  'Schmidt',  'DE', 'OH lover',       NOW(), NOW()),
  ('usr_cube04', 'sb_fake_04', 'rubiksfan',      'Carlos', 'Ramirez',  'MX', '',               NOW(), NOW()),
  ('usr_cube05', 'sb_fake_05', 'puzzle_pro',     'Eun',    'Lee',      'KR', 'BLD specialist', NOW(), NOW()),
  ('usr_cube06', 'sb_fake_06', 'twistandturn',   'Oliver', 'Brown',    'GB', '',               NOW(), NOW()),
  ('usr_cube07', 'sb_fake_07', 'algmaster',      'Sophie', 'Martin',   'FR', 'CFOP main',      NOW(), NOW()),
  ('usr_cube08', 'sb_fake_08', 'fastcuber',      'Aiden',  'Patel',    'IN', '',               NOW(), NOW()),
  ('usr_cube09', 'sb_fake_09', 'cubetimer',      'Mia',    'Anderson', 'SE', '',               NOW(), NOW()),
  ('usr_cube10', 'sb_fake_10', 'solveking',      'Noah',   'Kim',      'CA', '',               NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. Create events
-- ============================================================
INSERT INTO "Event" (id, name)
VALUES
  ('evt_222',   '222'),
  ('evt_333',   '333'),
  ('evt_444',   '444'),
  ('evt_555',   '555'),
  ('evt_666',   '666'),
  ('evt_777',   '777'),
  ('evt_333bf', '333bf'),
  ('evt_444bf', '444bf'),
  ('evt_555bf', '555bf'),
  ('evt_333oh', '333oh'),
  ('evt_pyram', 'pyram'),
  ('evt_mega',  'mega'),
  ('evt_skewb', 'skewb'),
  ('evt_sq1',   'sq1'),
  ('evt_clock', 'clock')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. Create 7 days of tournaments (Contest 41-47)
-- Today is 2026-03-28 PST. Current contest is 47.
-- ============================================================
INSERT INTO "Tournament" (id, number, "datePST", "createdAt")
VALUES
  ('trn_41', 41, '2026-03-22', NOW()),
  ('trn_42', 42, '2026-03-23', NOW()),
  ('trn_43', 43, '2026-03-24', NOW()),
  ('trn_44', 44, '2026-03-25', NOW()),
  ('trn_45', 45, '2026-03-26', NOW()),
  ('trn_46', 46, '2026-03-27', NOW()),
  ('trn_47', 47, '2026-03-28', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. Helper: Scramble sets for each event in each tournament
-- We create scramble sets for a subset of events per tournament
-- to test the "no entries" case (some events won't have sets).
-- ============================================================

-- Contest 47 (current) — 3x3, 2x2, 7x7, 3BLD, OH
-- 3x3: lots of competitors, various states
INSERT INTO "ScrambleSet" (id, "eventId", scrambles, "createdAt")
VALUES
  ('ss_47_333', 'evt_333', '["R U R'' U'' F R2 U'' R'' U R U R'' F''", "B2 L2 D R2 U'' L2 D2 F2 R2 U2 B'' R'' D R2 B D2 L D'' F''", "U2 F2 L2 D'' R2 D B2 U L2 F2 U'' F R'' D R U2 L F R''", "D2 L2 F'' D2 F'' U2 R2 B L2 F2 R2 D'' L'' B U2 R'' F2 R'' D U2", "L2 B2 U'' L2 U'' B2 D'' F2 R2 U2 B2 R'' B'' D2 U'' B'' L D R2 F''"]', NOW()),
  ('ss_47_222', 'evt_222', '["R U R'' F U2 R U2 R''", "F U'' R'' F2 U R2 U'' R''", "R'' U'' R U R'' F R U2", "U R2 F'' U R2 U R2 F''", "R U2 R'' U'' R U2 R'' F"]', NOW()),
  ('ss_47_777', 'evt_777', '["3Rw U2 3Fw'' R2 B L2 Dw2 F Dw2 Rw R''", "Fw2 D2 Lw2 Rw D Bw2 3Rw2 U B2 L2", "B2 Rw U2 3Fw'' R2 Dw2 Rw'' Bw Fw"]', NOW()),
  ('ss_47_333bf', 'evt_333bf', '["R U R'' U'' F R2 U'' R'' F''", "B2 L2 D R2 F2 R'' D R2 B", "U2 F2 L2 D'' R2 D B2 U L2", "D2 L2 F'' D2 F'' U2 R2 B L2", "L2 B2 U'' L2 U'' B2 D'' F2 R2"]', NOW()),
  ('ss_47_333oh', 'evt_333oh', '["R U R'' U'' F R2 U'' R'' U R", "B2 L2 D R2 U'' L2 D2 F2 R2 U2", "U2 F2 L2 D'' R2 D B2 U L2 F2", "D2 L2 F'' D2 F'' U2 R2 B L2 F2", "L2 B2 U'' L2 U'' B2 D'' F2 R2 U2"]', NOW()),
  -- Contest 46 (yesterday, ended)
  ('ss_46_333', 'evt_333', '["R2 U'' L2 F2 D B2 R2 U'' F2 D''", "F R U'' R'' U F'' R U R'' U''", "B L'' D2 R U2 L B2 R'' F2 L''", "U2 R2 F2 D L2 U'' R2 D2 B2 U''", "R'' F R U R'' U'' F'' U R U''"]', NOW()),
  ('ss_46_222', 'evt_222', '["R'' F U'' R2 F R U2", "U R U2 R'' F U2 R U''", "R2 U'' R U R'' F R2 F''", "F R'' U R2 U'' R'' F R", "U2 R2 F'' U R2 U R2"]', NOW()),
  -- Contest 45
  ('ss_45_333', 'evt_333', '["D R2 B2 U R2 F2 U2 L2 D2 B2 U''", "R'' U'' F'' R U F R'' U'' R U", "L2 D2 R2 B'' D2 L2 F D2 F'' R2 B''", "U B2 R2 D'' F2 R2 D L2 U2 B2 R2", "F2 D B2 L2 D2 F2 D F2 U'' R2 D"]', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. Tournament Entries + Solves
-- ============================================================

-- NOTE: Get your own user ID from the User table and replace 'YOUR_USER_ID' below.
-- You can find it by running: SELECT id, username FROM "User";

-- === CONTEST 47 (current) - 3x3 ===

-- cubegod99: completed, fast (ao5 ~7.2s = 7200ms)
INSERT INTO "TournamentEntry" (id, "userId", "tournamentId", "eventId", "scrambleSetId", result, "createdAt")
VALUES ('te_47_333_01', 'usr_cube01', 'trn_47', 'evt_333', 'ss_47_333', 7230, NOW());

INSERT INTO "Solve" (id, "userId", "eventId", "scrambleSetId", "scrambleSetIndex", time, penalty, "createdAt")
VALUES
  ('sol_47_333_01_0', 'usr_cube01', 'evt_333', 'ss_47_333', 0, 6890, NULL, NOW()),
  ('sol_47_333_01_1', 'usr_cube01', 'evt_333', 'ss_47_333', 1, 7450, NULL, NOW()),
  ('sol_47_333_01_2', 'usr_cube01', 'evt_333', 'ss_47_333', 2, 7120, NULL, NOW()),
  ('sol_47_333_01_3', 'usr_cube01', 'evt_333', 'ss_47_333', 3, 8010, NULL, NOW()),
  ('sol_47_333_01_4', 'usr_cube01', 'evt_333', 'ss_47_333', 4, 7110, NULL, NOW());

-- speedyfingers: completed (ao5 ~8.4s)
INSERT INTO "TournamentEntry" (id, "userId", "tournamentId", "eventId", "scrambleSetId", result, "createdAt")
VALUES ('te_47_333_02', 'usr_cube02', 'trn_47', 'evt_333', 'ss_47_333', 8410, NOW());

INSERT INTO "Solve" (id, "userId", "eventId", "scrambleSetId", "scrambleSetIndex", time, penalty, "createdAt")
VALUES
  ('sol_47_333_02_0', 'usr_cube02', 'evt_333', 'ss_47_333', 0, 8120, NULL, NOW()),
  ('sol_47_333_02_1', 'usr_cube02', 'evt_333', 'ss_47_333', 1, 9230, NULL, NOW()),
  ('sol_47_333_02_2', 'usr_cube02', 'evt_333', 'ss_47_333', 2, 7890, NULL, NOW()),
  ('sol_47_333_02_3', 'usr_cube02', 'evt_333', 'ss_47_333', 3, 8540, NULL, NOW()),
  ('sol_47_333_02_4', 'usr_cube02', 'evt_333', 'ss_47_333', 4, 8560, NULL, NOW());

-- cubemaster: completed (ao5 ~10.1s)
INSERT INTO "TournamentEntry" (id, "userId", "tournamentId", "eventId", "scrambleSetId", result, "createdAt")
VALUES ('te_47_333_03', 'usr_cube03', 'trn_47', 'evt_333', 'ss_47_333', 10120, NOW());

INSERT INTO "Solve" (id, "userId", "eventId", "scrambleSetId", "scrambleSetIndex", time, penalty, "createdAt")
VALUES
  ('sol_47_333_03_0', 'usr_cube03', 'evt_333', 'ss_47_333', 0, 10340, NULL, NOW()),
  ('sol_47_333_03_1', 'usr_cube03', 'evt_333', 'ss_47_333', 1, 9870, NULL, NOW()),
  ('sol_47_333_03_2', 'usr_cube03', 'evt_333', 'ss_47_333', 2, 10150, NULL, NOW()),
  ('sol_47_333_03_3', 'usr_cube03', 'evt_333', 'ss_47_333', 3, 11230, NULL, NOW()),
  ('sol_47_333_03_4', 'usr_cube03', 'evt_333', 'ss_47_333', 4, 8920, NULL, NOW());

-- rubiksfan: completed with a +2 penalty (ao5 ~11.5s)
INSERT INTO "TournamentEntry" (id, "userId", "tournamentId", "eventId", "scrambleSetId", result, "createdAt")
VALUES ('te_47_333_04', 'usr_cube04', 'trn_47', 'evt_333', 'ss_47_333', 11540, NOW());

INSERT INTO "Solve" (id, "userId", "eventId", "scrambleSetId", "scrambleSetIndex", time, penalty, "createdAt")
VALUES
  ('sol_47_333_04_0', 'usr_cube04', 'evt_333', 'ss_47_333', 0, 12340, NULL, NOW()),
  ('sol_47_333_04_1', 'usr_cube04', 'evt_333', 'ss_47_333', 1, 10890, NULL, NOW()),
  ('sol_47_333_04_2', 'usr_cube04', 'evt_333', 'ss_47_333', 2, 11420, NULL, NOW()),
  ('sol_47_333_04_3', 'usr_cube04', 'evt_333', 'ss_47_333', 3, 13010, NULL, NOW()),
  ('sol_47_333_04_4', 'usr_cube04', 'evt_333', 'ss_47_333', 4, 10560, 'plus_two', NOW());

-- puzzle_pro: completed (ao5 ~12.0s)
INSERT INTO "TournamentEntry" (id, "userId", "tournamentId", "eventId", "scrambleSetId", result, "createdAt")
VALUES ('te_47_333_05', 'usr_cube05', 'trn_47', 'evt_333', 'ss_47_333', 12030, NOW());

INSERT INTO "Solve" (id, "userId", "eventId", "scrambleSetId", "scrambleSetIndex", time, penalty, "createdAt")
VALUES
  ('sol_47_333_05_0', 'usr_cube05', 'evt_333', 'ss_47_333', 0, 11560, NULL, NOW()),
  ('sol_47_333_05_1', 'usr_cube05', 'evt_333', 'ss_47_333', 1, 12340, NULL, NOW()),
  ('sol_47_333_05_2', 'usr_cube05', 'evt_333', 'ss_47_333', 2, 12190, NULL, NOW()),
  ('sol_47_333_05_3', 'usr_cube05', 'evt_333', 'ss_47_333', 3, 13450, NULL, NOW()),
  ('sol_47_333_05_4', 'usr_cube05', 'evt_333', 'ss_47_333', 4, 10230, NULL, NOW());

-- twistandturn: completed with a DNF (ao5 ~12.9s, has 1 DNF which is dropped)
INSERT INTO "TournamentEntry" (id, "userId", "tournamentId", "eventId", "scrambleSetId", result, "createdAt")
VALUES ('te_47_333_06', 'usr_cube06', 'trn_47', 'evt_333', 'ss_47_333', 12890, NOW());

INSERT INTO "Solve" (id, "userId", "eventId", "scrambleSetId", "scrambleSetIndex", time, penalty, "createdAt")
VALUES
  ('sol_47_333_06_0', 'usr_cube06', 'evt_333', 'ss_47_333', 0, 12340, NULL, NOW()),
  ('sol_47_333_06_1', 'usr_cube06', 'evt_333', 'ss_47_333', 1, 13560, NULL, NOW()),
  ('sol_47_333_06_2', 'usr_cube06', 'evt_333', 'ss_47_333', 2, 12780, NULL, NOW()),
  ('sol_47_333_06_3', 'usr_cube06', 'evt_333', 'ss_47_333', 3, 11230, NULL, NOW()),
  ('sol_47_333_06_4', 'usr_cube06', 'evt_333', 'ss_47_333', 4, 0, 'dnf', NOW());

-- algmaster: completed DNF (2 DNFs = DNF average)
INSERT INTO "TournamentEntry" (id, "userId", "tournamentId", "eventId", "scrambleSetId", result, "createdAt")
VALUES ('te_47_333_07', 'usr_cube07', 'trn_47', 'evt_333', 'ss_47_333', 999999999, NOW());

INSERT INTO "Solve" (id, "userId", "eventId", "scrambleSetId", "scrambleSetIndex", time, penalty, "createdAt")
VALUES
  ('sol_47_333_07_0', 'usr_cube07', 'evt_333', 'ss_47_333', 0, 13450, NULL, NOW()),
  ('sol_47_333_07_1', 'usr_cube07', 'evt_333', 'ss_47_333', 1, 12890, NULL, NOW()),
  ('sol_47_333_07_2', 'usr_cube07', 'evt_333', 'ss_47_333', 2, 0, 'dnf', NOW()),
  ('sol_47_333_07_3', 'usr_cube07', 'evt_333', 'ss_47_333', 3, 13320, NULL, NOW()),
  ('sol_47_333_07_4', 'usr_cube07', 'evt_333', 'ss_47_333', 4, 0, 'dnf', NOW());

-- fastcuber: IN PROGRESS — only 3 solves done (no result yet)
INSERT INTO "TournamentEntry" (id, "userId", "tournamentId", "eventId", "scrambleSetId", result, "createdAt")
VALUES ('te_47_333_08', 'usr_cube08', 'trn_47', 'evt_333', 'ss_47_333', NULL, NOW());

INSERT INTO "Solve" (id, "userId", "eventId", "scrambleSetId", "scrambleSetIndex", time, penalty, "createdAt")
VALUES
  ('sol_47_333_08_0', 'usr_cube08', 'evt_333', 'ss_47_333', 0, 9870, NULL, NOW()),
  ('sol_47_333_08_1', 'usr_cube08', 'evt_333', 'ss_47_333', 1, 10230, NULL, NOW()),
  ('sol_47_333_08_2', 'usr_cube08', 'evt_333', 'ss_47_333', 2, 9450, NULL, NOW());

-- cubetimer: IN PROGRESS — only 1 solve done
INSERT INTO "TournamentEntry" (id, "userId", "tournamentId", "eventId", "scrambleSetId", result, "createdAt")
VALUES ('te_47_333_09', 'usr_cube09', 'trn_47', 'evt_333', 'ss_47_333', NULL, NOW());

INSERT INTO "Solve" (id, "userId", "eventId", "scrambleSetId", "scrambleSetIndex", time, penalty, "createdAt")
VALUES
  ('sol_47_333_09_0', 'usr_cube09', 'evt_333', 'ss_47_333', 0, 14560, NULL, NOW());

-- === CONTEST 47 (current) - 2x2 ===
-- Only 2 people competed

-- cubegod99: completed (ao5 ~2.8s)
INSERT INTO "TournamentEntry" (id, "userId", "tournamentId", "eventId", "scrambleSetId", result, "createdAt")
VALUES ('te_47_222_01', 'usr_cube01', 'trn_47', 'evt_222', 'ss_47_222', 2810, NOW());

INSERT INTO "Solve" (id, "userId", "eventId", "scrambleSetId", "scrambleSetIndex", time, penalty, "createdAt")
VALUES
  ('sol_47_222_01_0', 'usr_cube01', 'evt_222', 'ss_47_222', 0, 2340, NULL, NOW()),
  ('sol_47_222_01_1', 'usr_cube01', 'evt_222', 'ss_47_222', 1, 3120, NULL, NOW()),
  ('sol_47_222_01_2', 'usr_cube01', 'evt_222', 'ss_47_222', 2, 2890, NULL, NOW()),
  ('sol_47_222_01_3', 'usr_cube01', 'evt_222', 'ss_47_222', 3, 2560, NULL, NOW()),
  ('sol_47_222_01_4', 'usr_cube01', 'evt_222', 'ss_47_222', 4, 3450, NULL, NOW());

-- speedyfingers: completed (ao5 ~3.5s)
INSERT INTO "TournamentEntry" (id, "userId", "tournamentId", "eventId", "scrambleSetId", result, "createdAt")
VALUES ('te_47_222_02', 'usr_cube02', 'trn_47', 'evt_222', 'ss_47_222', 3520, NOW());

INSERT INTO "Solve" (id, "userId", "eventId", "scrambleSetId", "scrambleSetIndex", time, penalty, "createdAt")
VALUES
  ('sol_47_222_02_0', 'usr_cube02', 'evt_222', 'ss_47_222', 0, 3210, NULL, NOW()),
  ('sol_47_222_02_1', 'usr_cube02', 'evt_222', 'ss_47_222', 1, 4120, NULL, NOW()),
  ('sol_47_222_02_2', 'usr_cube02', 'evt_222', 'ss_47_222', 2, 3560, NULL, NOW()),
  ('sol_47_222_02_3', 'usr_cube02', 'evt_222', 'ss_47_222', 3, 3790, NULL, NOW()),
  ('sol_47_222_02_4', 'usr_cube02', 'evt_222', 'ss_47_222', 4, 2890, NULL, NOW());

-- === CONTEST 47 (current) - 7x7 (Mo3, only 3 solves) ===
-- cubegod99: completed
INSERT INTO "TournamentEntry" (id, "userId", "tournamentId", "eventId", "scrambleSetId", result, "createdAt")
VALUES ('te_47_777_01', 'usr_cube01', 'trn_47', 'evt_777', 'ss_47_777', 185000, NOW());

INSERT INTO "Solve" (id, "userId", "eventId", "scrambleSetId", "scrambleSetIndex", time, penalty, "createdAt")
VALUES
  ('sol_47_777_01_0', 'usr_cube01', 'evt_777', 'ss_47_777', 0, 182000, NULL, NOW()),
  ('sol_47_777_01_1', 'usr_cube01', 'evt_777', 'ss_47_777', 1, 191000, NULL, NOW()),
  ('sol_47_777_01_2', 'usr_cube01', 'evt_777', 'ss_47_777', 2, 182000, NULL, NOW());

-- === CONTEST 47 (current) - 3BLD (Bo5, ranked by single) ===
-- puzzle_pro: completed with 3 DNFs, 2 successes
INSERT INTO "TournamentEntry" (id, "userId", "tournamentId", "eventId", "scrambleSetId", result, "createdAt")
VALUES ('te_47_333bf_01', 'usr_cube05', 'trn_47', 'evt_333bf', 'ss_47_333bf', 45230, NOW());

INSERT INTO "Solve" (id, "userId", "eventId", "scrambleSetId", "scrambleSetIndex", time, penalty, "createdAt")
VALUES
  ('sol_47_333bf_05_0', 'usr_cube05', 'evt_333bf', 'ss_47_333bf', 0, 0, 'dnf', NOW()),
  ('sol_47_333bf_05_1', 'usr_cube05', 'evt_333bf', 'ss_47_333bf', 1, 52340, NULL, NOW()),
  ('sol_47_333bf_05_2', 'usr_cube05', 'evt_333bf', 'ss_47_333bf', 2, 0, 'dnf', NOW()),
  ('sol_47_333bf_05_3', 'usr_cube05', 'evt_333bf', 'ss_47_333bf', 3, 45230, NULL, NOW()),
  ('sol_47_333bf_05_4', 'usr_cube05', 'evt_333bf', 'ss_47_333bf', 4, 0, 'dnf', NOW());

-- === CONTEST 47 (current) - OH ===
-- No entries at all! (tests the empty event case on the scramble set)

-- === CONTEST 46 (yesterday, ended) - 3x3 ===
-- cubegod99: completed
INSERT INTO "TournamentEntry" (id, "userId", "tournamentId", "eventId", "scrambleSetId", result, "createdAt")
VALUES ('te_46_333_01', 'usr_cube01', 'trn_46', 'evt_333', 'ss_46_333', 7450, NOW());

INSERT INTO "Solve" (id, "userId", "eventId", "scrambleSetId", "scrambleSetIndex", time, penalty, "createdAt")
VALUES
  ('sol_46_333_01_0', 'usr_cube01', 'evt_333', 'ss_46_333', 0, 7230, NULL, NOW()),
  ('sol_46_333_01_1', 'usr_cube01', 'evt_333', 'ss_46_333', 1, 7890, NULL, NOW()),
  ('sol_46_333_01_2', 'usr_cube01', 'evt_333', 'ss_46_333', 2, 7120, NULL, NOW()),
  ('sol_46_333_01_3', 'usr_cube01', 'evt_333', 'ss_46_333', 3, 8230, NULL, NOW()),
  ('sol_46_333_01_4', 'usr_cube01', 'evt_333', 'ss_46_333', 4, 6980, NULL, NOW());

-- speedyfingers: completed
INSERT INTO "TournamentEntry" (id, "userId", "tournamentId", "eventId", "scrambleSetId", result, "createdAt")
VALUES ('te_46_333_02', 'usr_cube02', 'trn_46', 'evt_333', 'ss_46_333', 8890, NOW());

INSERT INTO "Solve" (id, "userId", "eventId", "scrambleSetId", "scrambleSetIndex", time, penalty, "createdAt")
VALUES
  ('sol_46_333_02_0', 'usr_cube02', 'evt_333', 'ss_46_333', 0, 8450, NULL, NOW()),
  ('sol_46_333_02_1', 'usr_cube02', 'evt_333', 'ss_46_333', 1, 9120, NULL, NOW()),
  ('sol_46_333_02_2', 'usr_cube02', 'evt_333', 'ss_46_333', 2, 8990, NULL, NOW()),
  ('sol_46_333_02_3', 'usr_cube02', 'evt_333', 'ss_46_333', 3, 9230, NULL, NOW()),
  ('sol_46_333_02_4', 'usr_cube02', 'evt_333', 'ss_46_333', 4, 8670, NULL, NOW());

-- cubemaster: IN PROGRESS on yesterday's contest — only 2 solves (will show as DNS since ended)
INSERT INTO "TournamentEntry" (id, "userId", "tournamentId", "eventId", "scrambleSetId", result, "createdAt")
VALUES ('te_46_333_03', 'usr_cube03', 'trn_46', 'evt_333', 'ss_46_333', NULL, NOW());

INSERT INTO "Solve" (id, "userId", "eventId", "scrambleSetId", "scrambleSetIndex", time, penalty, "createdAt")
VALUES
  ('sol_46_333_03_0', 'usr_cube03', 'evt_333', 'ss_46_333', 0, 10560, NULL, NOW()),
  ('sol_46_333_03_1', 'usr_cube03', 'evt_333', 'ss_46_333', 1, 11230, NULL, NOW());

-- === CONTEST 46 (yesterday) - 2x2 ===
-- cubegod99: completed
INSERT INTO "TournamentEntry" (id, "userId", "tournamentId", "eventId", "scrambleSetId", result, "createdAt")
VALUES ('te_46_222_01', 'usr_cube01', 'trn_46', 'evt_222', 'ss_46_222', 2650, NOW());

INSERT INTO "Solve" (id, "userId", "eventId", "scrambleSetId", "scrambleSetIndex", time, penalty, "createdAt")
VALUES
  ('sol_46_222_01_0', 'usr_cube01', 'evt_222', 'ss_46_222', 0, 2230, NULL, NOW()),
  ('sol_46_222_01_1', 'usr_cube01', 'evt_222', 'ss_46_222', 1, 2890, NULL, NOW()),
  ('sol_46_222_01_2', 'usr_cube01', 'evt_222', 'ss_46_222', 2, 2780, NULL, NOW()),
  ('sol_46_222_01_3', 'usr_cube01', 'evt_222', 'ss_46_222', 3, 2340, NULL, NOW()),
  ('sol_46_222_01_4', 'usr_cube01', 'evt_222', 'ss_46_222', 4, 3120, NULL, NOW());

-- === CONTEST 45 - 3x3 (5 competitors, all completed) ===
INSERT INTO "TournamentEntry" (id, "userId", "tournamentId", "eventId", "scrambleSetId", result, "createdAt")
VALUES
  ('te_45_333_01', 'usr_cube01', 'trn_45', 'evt_333', 'ss_45_333', 7120, NOW()),
  ('te_45_333_02', 'usr_cube02', 'trn_45', 'evt_333', 'ss_45_333', 8230, NOW()),
  ('te_45_333_03', 'usr_cube03', 'trn_45', 'evt_333', 'ss_45_333', 9980, NOW()),
  ('te_45_333_04', 'usr_cube04', 'trn_45', 'evt_333', 'ss_45_333', 11230, NOW()),
  ('te_45_333_05', 'usr_cube05', 'trn_45', 'evt_333', 'ss_45_333', 12450, NOW());

INSERT INTO "Solve" (id, "userId", "eventId", "scrambleSetId", "scrambleSetIndex", time, penalty, "createdAt")
VALUES
  -- cubegod99
  ('sol_45_333_01_0', 'usr_cube01', 'evt_333', 'ss_45_333', 0, 6890, NULL, NOW()),
  ('sol_45_333_01_1', 'usr_cube01', 'evt_333', 'ss_45_333', 1, 7450, NULL, NOW()),
  ('sol_45_333_01_2', 'usr_cube01', 'evt_333', 'ss_45_333', 2, 7230, NULL, NOW()),
  ('sol_45_333_01_3', 'usr_cube01', 'evt_333', 'ss_45_333', 3, 6680, NULL, NOW()),
  ('sol_45_333_01_4', 'usr_cube01', 'evt_333', 'ss_45_333', 4, 7890, NULL, NOW()),
  -- speedyfingers
  ('sol_45_333_02_0', 'usr_cube02', 'evt_333', 'ss_45_333', 0, 8120, NULL, NOW()),
  ('sol_45_333_02_1', 'usr_cube02', 'evt_333', 'ss_45_333', 1, 8450, NULL, NOW()),
  ('sol_45_333_02_2', 'usr_cube02', 'evt_333', 'ss_45_333', 2, 8120, NULL, NOW()),
  ('sol_45_333_02_3', 'usr_cube02', 'evt_333', 'ss_45_333', 3, 7890, NULL, NOW()),
  ('sol_45_333_02_4', 'usr_cube02', 'evt_333', 'ss_45_333', 4, 8890, NULL, NOW()),
  -- cubemaster
  ('sol_45_333_03_0', 'usr_cube03', 'evt_333', 'ss_45_333', 0, 9870, NULL, NOW()),
  ('sol_45_333_03_1', 'usr_cube03', 'evt_333', 'ss_45_333', 1, 10120, NULL, NOW()),
  ('sol_45_333_03_2', 'usr_cube03', 'evt_333', 'ss_45_333', 2, 9950, NULL, NOW()),
  ('sol_45_333_03_3', 'usr_cube03', 'evt_333', 'ss_45_333', 3, 10230, NULL, NOW()),
  ('sol_45_333_03_4', 'usr_cube03', 'evt_333', 'ss_45_333', 4, 9560, NULL, NOW()),
  -- rubiksfan
  ('sol_45_333_04_0', 'usr_cube04', 'evt_333', 'ss_45_333', 0, 11230, NULL, NOW()),
  ('sol_45_333_04_1', 'usr_cube04', 'evt_333', 'ss_45_333', 1, 11450, NULL, NOW()),
  ('sol_45_333_04_2', 'usr_cube04', 'evt_333', 'ss_45_333', 2, 10980, NULL, NOW()),
  ('sol_45_333_04_3', 'usr_cube04', 'evt_333', 'ss_45_333', 3, 11560, NULL, NOW()),
  ('sol_45_333_04_4', 'usr_cube04', 'evt_333', 'ss_45_333', 4, 10890, NULL, NOW()),
  -- puzzle_pro
  ('sol_45_333_05_0', 'usr_cube05', 'evt_333', 'ss_45_333', 0, 12340, NULL, NOW()),
  ('sol_45_333_05_1', 'usr_cube05', 'evt_333', 'ss_45_333', 1, 12560, NULL, NOW()),
  ('sol_45_333_05_2', 'usr_cube05', 'evt_333', 'ss_45_333', 2, 12450, NULL, NOW()),
  ('sol_45_333_05_3', 'usr_cube05', 'evt_333', 'ss_45_333', 3, 11890, NULL, NOW()),
  ('sol_45_333_05_4', 'usr_cube05', 'evt_333', 'ss_45_333', 4, 13120, NULL, NOW());
