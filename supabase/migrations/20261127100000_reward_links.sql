-- Reward messages as the client wrote them (Notion "Heartbeat Messages"): one text for every milestone,
-- with the student's first name, the post number and a "Click here to claim it" link to that
-- milestone's prize. The links are set per milestone in Settings; a reward without a link is held back.
alter table settings add column if not exists reward_links jsonb not null default '{}';

update settings set
  reward_message = 'Hi {first_name},

Congrats on reaching post #{step} of the 100-Post Challenge! 🙌

Here''s your prize 🎁 👉 {claim}

Keep going. Every post you publish gets you one step closer to your goal, and to the trips you''re dreaming of ✈️

I''m rooting for you, and always remember: consistency is key 💛',
  reward_links = reward_links || '{
    "10": "https://travelamore.notion.site/p/Tool-Recommendations-424f2e2d77aa807a8c66ca9bdd9e2fe1",
    "15": "https://travelamore.notion.site/Olly-Your-Destination-Researcher-424f2e2d77aa805e913dfbba06124e71",
    "30": "https://travelamore.notion.site/p/Travel-Music-Library-424f2e2d77aa807298f5c848ae633d3a"}'
where id = 1;
