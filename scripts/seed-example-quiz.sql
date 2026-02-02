-- Example Quiz Seed Data
-- This adds a quiz lesson to the existing course

-- Insert quiz lesson (assuming module_id=1 and course_id=1 from seed)
INSERT INTO lessons (module_id, course_id, title, content, type, sort_order)
VALUES (
    1,
    1,
    'Тест: Перевірка знань',
    'Перевірте свої знання з техніки блонду з глибиною кореня. Для продовження необхідно набрати 70%.',
    'quiz',
    5
);

-- Get the lesson ID (will be auto-incremented)
-- For this example, assume it's lesson_id = 10

-- Question 1: Single choice
INSERT INTO quiz_questions (lesson_id, question, type, explanation, hint, points, sort_order)
VALUES (
    10,
    'Який рівень тону використовується для створення глибини кореня?',
    'single',
    '7 рівень дає теплу базу, що створює м''яку тінь і природний вигляд.',
    'Згадайте про теплі відтінки базового тону',
    10,
    1
);

INSERT INTO quiz_answers (question_id, answer_text, is_correct, sort_order)
VALUES
    (1, '5 рівень', 0, 1),
    (1, '7 рівень', 1, 2),
    (1, '9 рівень', 0, 3),
    (1, '10 рівень', 0, 4);

-- Question 2: Single choice
INSERT INTO quiz_questions (lesson_id, question, type, explanation, hint, points, sort_order)
VALUES (
    10,
    'Яка основна перевага техніки блонд з глибиною кореня?',
    'single',
    'Ця техніка створює візуальну густоту волосся завдяки м''якій тіні біля коренів.',
    'Подумайте про візуальний ефект',
    10,
    2
);

INSERT INTO quiz_answers (question_id, answer_text, is_correct, sort_order)
VALUES
    (2, 'Швидше виконується', 0, 1),
    (2, 'Волосся виглядає густішим', 1, 2),
    (2, 'Дешевші матеріали', 0, 3),
    (2, 'Не потрібна тонування', 0, 4);

-- Question 3: Multiple choice
INSERT INTO quiz_questions (lesson_id, question, type, explanation, hint, points, sort_order)
VALUES (
    10,
    'Які продукти необхідні для виконання техніки? (оберіть кілька)',
    'multiple',
    'Для якісного результату потрібні освітлювач, тонер для відтінку та засіб захисту волосся.',
    'Згадайте всі етапи процесу',
    15,
    3
);

INSERT INTO quiz_answers (question_id, answer_text, is_correct, sort_order)
VALUES
    (3, 'Освітлювальний порошок', 1, 1),
    (3, 'Тонер', 1, 2),
    (3, 'Звичайний шампунь', 0, 3),
    (3, 'Bond протектор', 1, 4),
    (3, 'Воск для укладки', 0, 5);

-- Question 4: Single choice
INSERT INTO quiz_questions (lesson_id, question, type, explanation, hint, points, sort_order)
VALUES (
    10,
    'Скільки часу потрібно витримувати освітлювач на довжині?',
    'single',
    'Час витримки залежить від початкового рівня та бажаного результату, але важливо не передержати.',
    'Це індивідуально для кожного клієнта',
    10,
    4
);

INSERT INTO quiz_answers (question_id, answer_text, is_correct, sort_order)
VALUES
    (4, 'Фіксований час 30 хвилин для всіх', 0, 1),
    (4, 'Залежить від стану волосся та бажаного результату', 1, 2),
    (4, 'Чим довше, тим краще', 0, 3),
    (4, 'Не має значення', 0, 4);

-- Question 5: Single choice
INSERT INTO quiz_questions (lesson_id, question, type, explanation, hint, points, sort_order)
VALUES (
    10,
    'Який продукт рекомендується для догляду після процедури?',
    'single',
    'Спеціальний шампунь для блонду допомагає зберегти холодний відтінок та здоров''я волосся.',
    'Подумайте про підтримку кольору',
    10,
    5
);

INSERT INTO quiz_answers (question_id, answer_text, is_correct, sort_order)
VALUES
    (5, 'Будь-який шампунь', 0, 1),
    (5, 'Шампунь для блонду з фіолетовим пігментом', 1, 2),
    (5, 'Шампунь проти лупи', 0, 3),
    (5, 'Дитячий шампунь', 0, 4);

-- Quiz Settings
INSERT INTO quiz_settings (lesson_id, passing_score, max_attempts, shuffle_questions, shuffle_answers, show_explanations, require_pass)
VALUES (
    10,
    70.0,  -- 70% to pass
    3,     -- Maximum 3 attempts
    1,     -- Shuffle questions
    1,     -- Shuffle answers
    1,     -- Show explanations after answer
    1      -- Require pass to continue course
);

-- Remedial Content (for students who fail)
INSERT INTO remedial_content (lesson_id, title, content, content_type, sort_order)
VALUES
    (10, 'Основи колористики', '<h3>Повторіть основи теорії кольору</h3><p>Перед тим як працювати з блондом, важливо розуміти базові принципи колористики:<ul><li><strong>Рівні тону:</strong> від 1 (чорний) до 10 (найсвітліший блонд)</li><li><strong>Напрямок кольору:</strong> теплий, холодний, нейтральний</li><li><strong>Фон освітлення:</strong> який колір з''являється при освітленні волосся</li></ul></p>', 'text', 1),
    (10, 'Техніка нанесення', '<h3>Правильне нанесення - запорука успіху</h3><p>Перегляньте ключові моменти техніки:<ol><li>Розділення волосся на зони</li><li>Відступ від кореня 2-3 см</li><li>Рівномірне нанесення складу</li><li>Контроль часу витримки</li><li>Ретельне змивання</li></ol></p>', 'text', 2),
    (10, 'Поширені помилки', '<h3>Уникайте цих помилок</h3><p><ul><li>❌ Надто сильна концентрація оксиданту</li><li>❌ Недостатній час витримки</li><li>❌ Нанесення на брудне волосся</li><li>❌ Ігнорування стану волосся</li><li>✅ Завжди проводьте тест на пасмі!</li></ul></p>', 'text', 3);

-- Note: You'll need to update the lesson_id values (10) to match the actual auto-incremented ID
-- You can check it with: SELECT id FROM lessons WHERE title = 'Тест: Перевірка знань';
