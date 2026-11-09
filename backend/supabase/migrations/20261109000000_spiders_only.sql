-- The spider filter covers spiders only, not insects. The old prompt missed
-- spiders that were close up, in the background or out of focus (checked by
-- hand on "You're Aragog", YouTube 7Zyn823Qxv8), so the prompt now names
-- those cases. Existing answers aren't re-asked: only new frames use it.
update public.content_filters
set label = 'Spiders',
    prompt = 'Does this movie frame show a spider anywhere in the image? Answer yes even if the spider is small, in the background, out of focus, in shadow or darkness, motionless, seen in close-up, only partly visible (such as legs, fangs, eyes or part of its body), a giant or monster spider, a swarm of spiders, or an animated, toy or illustrated spider. Answer no for insects, scorpions, crabs and other animals, and for a spider web with no spider in it.'
where key = 'spiders'
  and user_id = '27507de5-a60a-4089-9969-3be4382b7f97';
