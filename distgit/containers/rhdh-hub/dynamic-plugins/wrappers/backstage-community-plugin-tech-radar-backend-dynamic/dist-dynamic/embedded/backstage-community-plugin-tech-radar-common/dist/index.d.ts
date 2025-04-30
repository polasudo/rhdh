import { z } from 'zod';

/**
 * Response from that contains all the data for a Tech Radar graph;
 *  {@link RadarQuadrant}, {@link RadarRing}, and {@link RadarEntry}.
 *
 * @public
 */
interface TechRadarLoaderResponse {
    /**
     * Quadrant of Tech Radar. Should be 4
     */
    quadrants: RadarQuadrant[];
    /**
     * Rings of Tech Radar
     */
    rings: RadarRing[];
    /**
     * Entries visualised in Tech Radar
     */
    entries: RadarEntry[];
}
/**
 * Single Entry in Tech Radar
 *
 * @public
 */
interface RadarEntry {
    /**
     * React key to use for this Entry
     */
    key: string;
    /**
     * ID of this Radar Entry
     */
    id: string;
    /**
     * ID of {@link RadarQuadrant} this Entry belongs to
     */
    quadrant: string;
    /**
     * Display name of the Entry
     */
    title: string;
    /**
     * User-clickable URL when rendered in Radar
     *
     * @remarks
     *
     * You can use `#` if you don't want to provide any other url
     *
     * @deprecated Use {@link RadarEntry.links} instead
     */
    url?: string;
    /**
     * History of the Entry moving through {@link RadarRing}
     */
    timeline: Array<RadarEntrySnapshot>;
    /**
     * Description of the Entry
     */
    description?: string;
    /**
     * User-clickable links to provide more information about the Entry
     */
    links?: Array<RadarEntryLink>;
}
/**
 * Tech Radar Ring which indicates stage of {@link RadarEntry}
 *
 * @public
 */
interface RadarRing {
    /**
     * ID of the Ring
     */
    id: string;
    /**
     * Display name of the Ring
     */
    name: string;
    /**
     * Color used for entries in particular Ring
     *
     * @remarks
     *
     * Supports any value parseable by {@link https://www.npmjs.com/package/color-string | color-string}
     */
    color: string;
    /**
     * Description of the Ring
     */
    description?: string;
}
/**
 * Tech Radar Quadrant which represent area/topic of {@link RadarEntry}
 *
 * @public
 */
interface RadarQuadrant {
    /**
     * ID of the Quadrant
     */
    id: string;
    /**
     * Display name of the Quadrant
     */
    name: string;
}
/**
 * Single link in {@link RadarEntry}
 *
 * @public
 */
interface RadarEntryLink {
    /**
     * URL of the link
     */
    url: string;
    /**
     * Display name of the link
     */
    title: string;
}
/**
 * Indicates how {@link RadarEntry} moved though {@link RadarRing} on the {@link RadarEntry} timeline
 *
 * @public
 */
declare enum MovedState {
    /**
     * Moved down
     */
    Down = -1,
    /**
     * Didn't move
     */
    NoChange = 0,
    /**
     * Move up
     */
    Up = 1
}
/**
 * State of {@link RadarEntry} at given point in time
 *
 * @public
 */
interface RadarEntrySnapshot {
    /**
     * Point in time when change happened
     */
    date: Date;
    /**
     * ID of {@link RadarRing}
     */
    ringId: string;
    /**
     * Description of change
     */
    description?: string;
    /**
     * Indicates trend compared to previous snapshot
     */
    moved?: MovedState;
}

/**
 * Parser for the response from Tech Radar loader.
 *
 * @public
 */
declare const TechRadarLoaderResponseParser: z.ZodSchema<TechRadarLoaderResponse>;

export { MovedState, type RadarEntry, type RadarEntryLink, type RadarEntrySnapshot, type RadarQuadrant, type RadarRing, type TechRadarLoaderResponse, TechRadarLoaderResponseParser };
