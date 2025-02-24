'use strict';

var zod = require('zod');
var model = require('./model.cjs.js');

const RadarRingParser = zod.z.object({
  // ID of the Ring
  id: zod.z.string(),
  // Display name of the Ring
  name: zod.z.string(),
  // Color used for entries in particular Ring, Supports any value parseable by {@link https://www.npmjs.com/package/color-string | color-string}
  color: zod.z.string(),
  // Description of the Ring
  description: zod.z.string().optional()
});
const RadarQuadrantParser = zod.z.object({
  // ID of the Quadrant
  id: zod.z.string(),
  // Display name of the Quadrant
  name: zod.z.string()
});
const RadarEntryLinkParser = zod.z.object({
  // URL of the link
  url: zod.z.string(),
  // Display name of the link
  title: zod.z.string()
});
const RadarEntrySnapshotParser = zod.z.object({
  // Point in time when change happened
  date: zod.z.coerce.date(),
  // ID of {@link RadarRing}
  ringId: zod.z.string(),
  // Description of change
  description: zod.z.string().optional(),
  // Indicates trend compared to previous snapshot
  moved: zod.z.nativeEnum(model.MovedState).optional()
});
const RadarEntryParser = zod.z.object({
  // React key to use for this Entry
  key: zod.z.string(),
  // ID of this Radar Entry
  id: zod.z.string(),
  // ID of {@link RadarQuadrant} this Entry belongs to
  quadrant: zod.z.string(),
  // Display name of the Entry
  title: zod.z.string(),
  // User-clickable URL when rendered in Radar
  url: zod.z.string().optional(),
  // History of the Entry moving through {@link RadarRing}
  timeline: zod.z.array(RadarEntrySnapshotParser),
  // Description of the Entry
  description: zod.z.string().optional(),
  // User-clickable links to provide more information about the Entry
  links: zod.z.array(RadarEntryLinkParser).optional()
});
const TechRadarLoaderResponseParser = zod.z.object({
  quadrants: zod.z.array(RadarQuadrantParser),
  rings: zod.z.array(RadarRingParser),
  entries: zod.z.array(RadarEntryParser)
});

exports.TechRadarLoaderResponseParser = TechRadarLoaderResponseParser;
//# sourceMappingURL=schema.cjs.js.map
