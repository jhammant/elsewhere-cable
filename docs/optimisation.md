# Elsewhere Cable optimisation

Elsewhere Cable uses a bounded experiment loop inspired by
[karpathy/autoresearch](https://github.com/karpathy/autoresearch). The useful idea is not
uncontrolled self-modification. It is a fixed evaluator, a fixed experiment budget, a narrow
change surface, explicit keep/discard decisions and an append-only result history.

## Immutable harness

Experiments must not change:

- the public-stream availability requirement;
- safety and originality gates;
- the scorecard weights or guardrail thresholds during an experiment;
- the 30-minute observation window;
- the protected uploader, encoder or Endor secret handling;
- the rule that repeat reserve is preferable to dead air.

Changing the evaluator and the candidate in the same experiment invalidates the result.

## Primary metric

The comparable experience index is a 0–100 weighted score:

| Dimension             | Weight | Evidence                                                                                                  |
| --------------------- | -----: | --------------------------------------------------------------------------------------------------------- |
| Editorial quality     |    40% | bounded critic scores for clarity, escalation, dialogue, visual match, pace, originality and shareability |
| Delivered reliability |    25% | public live state, fallback count, silence ratio and freeze ratio                                         |
| Programme novelty     |    20% | unique programme ratio in the delivered window                                                            |
| Production diversity  |    15% | format, visual medium, cast and pacing coverage                                                           |

Audience size is an outcome KPI, not part of the quality index. Early concurrent-viewer counts are
too small and noisy to serve as an evaluator. Watch time, average view duration and retention should
be added from authenticated YouTube Analytics when available.

## Hard guardrails

A candidate cannot be kept when any measured guardrail fails:

- the public stream is not live;
- fallback or failed-segment occurrences are non-zero;
- delivered silence is 15% or higher;
- delivered freeze is 18% or higher;
- programme uniqueness is below 80%;
- fewer than 20 segments were observed.

Safety, schema validity and originality remain pre-broadcast gates rather than scorecard trade-offs.

## Experiment loop

1. Register one hypothesis and one change surface.
2. Record the last complete 30-minute window as the baseline.
3. Make the smallest coherent change that tests the hypothesis.
4. Run deterministic tests, visual QA, audio timing checks and a renderer benchmark.
5. For renderer-only work, use the guarded A/B handover. Never restart the uploader.
6. Wait for a complete 30-minute candidate window after activation.
7. Compare the candidate with the baseline using the frozen scorecard.
8. `keep` only when all guardrails pass and the experience index improves by at least one point.
9. Otherwise record `discard`, or `inconclusive` when evidence coverage is below 80%.
10. For a discarded renderer experiment, revert the tested commit and deploy it with
    `pnpm endor:renderer:refresh -- rollback`. This performs the same guarded A/B handover without
    registering the rollback commit as a new experiment.
11. Preserve the result and move to a different hypothesis.

When the latest commit title is not the renderer hypothesis, label the live arm explicitly:
`ELSEWHERE_RENDERER_EXPERIMENT_HYPOTHESIS='Synchronise story sounds with prop reactions' pnpm
endor:renderer:refresh`. The override changes only experiment metadata; the guarded handover
remains identical.

Generation experiments take effect only when tagged candidate material actually airs. Their
observation clock starts at first broadcast, not at code deployment.

## Commands

```bash
pnpm optimise:experiment -- \
  --build <commit> \
  --surface renderer-direction \
  --hypothesis "Distinct shot grammars increase pace variety without harming clarity"

pnpm optimise:scorecard
```

Runtime files are written under `data/optimisation/`:

```text
history.ndjson       raw 30-minute editorial/delivery observations
experiments.ndjson   append-only experiment registry
scorecard.json       machine-readable trend and decision state
progress.md          current human-readable report
```

## Operational split

- Ghost proposes and evaluates changes, generates scripts and voices, and maintains experiment
  history.
- Endor remains the stable playout and upload host.
- Renderer candidates are tested off-air before a guarded handover.
- Script-generation candidates remain quarantined until validation, safety, novelty, TTS and package
  preparation succeed.

The optimisation loop may improve the channel indefinitely, but it does not gain authority to make
destructive changes, expose services, alter secrets or stop the live stream.

## Experiment arms

Only one arm should change in a measured experiment:

| Arm                  | Capability                                          | Important guardrail                         |
| -------------------- | --------------------------------------------------- | ------------------------------------------- |
| `story_engine`       | premises, conflict, escalation and endings          | safety, originality and coherence           |
| `continuity`         | recurring characters and cross-channel consequences | no repetition disguised as continuity       |
| `performance`        | gestures, blocking, reactions and prop action       | renderer FPS and visual legibility          |
| `visual_medium`      | new 2D, 3D and mixed-media renderers                | renderer FPS and protected subtitles        |
| `direction`          | camera grammar and editing rhythm                   | freeze ratio and clarity                    |
| `broadcast_graphics` | typography, idents, tickers and layouts             | subtitle and channel-number safety          |
| `music`              | original beds, jingles and stings                   | silence, intelligibility and copyright      |
| `sound_design`       | ambience, prop sounds and signal texture            | intelligibility and mix headroom            |
| `voice`              | identity, acting, pronunciation and timing          | audio continuity and dialogue completeness  |
| `channel_switching`  | format mix, duration and return scheduling          | no dead air or unfinished accidental cuts   |
| `runway`             | script throughput, TTS and packaging                | only approved, genuinely fresh content      |
| `distribution`       | titles, thumbnails, highlights and schedules        | manual review before public changes         |
| `evaluation`         | critics, analytics and confidence                   | evaluator remains frozen during candidates  |
| `audience_research`  | public viewing patterns and first-party retention   | source text never enters generation prompts |
| `reliability`        | watchdog, audio and fallback behaviour              | uploader remains uninterrupted              |

Music should begin with deterministic original material, programme-specific motifs, conservative
mix headroom and automatic speech ducking. It must pass a shadow mix before reaching the public
renderer. Recognisable melodies, performers and copyrighted recordings are prohibited.

## Audience research loop

Public trend research is deliberately separate from the quality score. Every 12 hours, the
research worker samples three official YouTube Data API surfaces: the regional `mostPopular`
chart, the most-viewed recent entertainment videos and entertainment livestreams ordered by
concurrent viewers:

```bash
YOUTUBE_DATA_API_KEY_FILE=/protected/path/youtube-data-api-key pnpm research:audience:loop
```

The key is read from an environment variable or protected file and is never written to the
repository. The worker reads titles only long enough to count a small, fixed taxonomy of abstract
viewing mechanisms such as visible transformation, bounded challenge, reveal chain and legible
process. It does not retain source titles or pass raw source text to an LLM. The strongest current
abstract hypothesis is attached to the next optimisation brief, so the writer can test the
mechanism using wholly original characters, worlds and jokes.

A popularity hypothesis still passes the normal safety and originality gates, airs for a complete
candidate window and must improve the fixed evaluator before it is kept. This prevents popularity
research from turning Elsewhere Cable into imitation.

The stronger long-term signal is first-party behaviour: average view duration, watch time,
retention, likes, chat rate and returning viewers. Authenticated, read-only YouTube Analytics access
is required for those metrics. Until it is configured, public concurrent-viewer counts remain an
outcome indicator rather than a quality score.
