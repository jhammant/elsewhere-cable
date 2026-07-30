import { describe, expect, it } from 'vitest';
import { resolveFictionalBackground } from './fictional-backgrounds.js';

function programme(premise: string, format: 'news' | 'sitcom' | 'ident' = 'sitcom') {
  return {
    programme: {
      id: 'fictional_background_test',
      title: 'Background Test',
      premise,
      format,
    },
  };
}

describe('resolveFictionalBackground', () => {
  it('routes impossible locations to concrete fictional scenic families', () => {
    expect(
      resolveFictionalBackground(programme('Inside a coral greenhouse, two hosts bargain.')),
    ).toBe('aquatic_observatory');
    expect(
      resolveFictionalBackground(programme('On an orchard train, a gardener wants one seat.')),
    ).toBe('transit_room');
    expect(
      resolveFictionalBackground(
        programme('Inside a mechanical peacock cabaret stage, two acts wait.'),
      ),
    ).toBe('theatre');
  });

  it('falls back to format-appropriate original scenery', () => {
    expect(
      resolveFictionalBackground(programme('At an unnamed desk, two people disagree.', 'news')),
    ).toBe('newsroom');
    expect(
      resolveFictionalBackground(programme('Inside an unlabelled room, two cousins wait.')),
    ).toBe('domestic_room');
  });
});
