import {
    BufferGeometry,
    Material,
    Mesh,
    Scene
} from 'three';

import {
    IfcState,
    HighlightConfig,
    GeometriesByMaterials,
    IdGeometries,
    merge,
    SelectedItems,
    DEFAULT
} from './BaseDefinitions';

export class IfcSubsetController {
    private ifcState: IfcState;
    private activeSelections: SelectedItems = {};

    constructor(state: IfcState) {
        this.ifcState = state;
    }

    /** Return existing subset mesh */
    getSubset(modelID: number, material?: Material): Mesh | null {
        const key = this.buildKey(modelID, material);
        return this.activeSelections[key]?.mesh ?? null;
    }

    /** Remove subset from memory and optionally from scene */
    clearSubset(
        modelID: number,
        scene?: Scene,
        material?: Material
    ) {
        const key = this.buildKey(modelID, material);
        const entry = this.activeSelections[key];
        if (!entry) return;

        if (scene) scene.remove(entry.mesh);
        delete this.activeSelections[key];
    }

    /** Main subset creation entry */
    createSubset(config: HighlightConfig) {
        if (!this.isConfigUsable(config)) return;
        if (this.isDuplicateSelection(config)) return;
        if (this.shouldAppend(config)) {
            return this.appendSelection(config);
        }

        this.prepareSelectionGroup(config.scene, config);
        return this.spawnSubset(config);
    }

    // =====================
    // Internal logic
    // =====================

    private spawnSubset(config: HighlightConfig): Mesh {
        const filtered = this.collectFilteredGeometries(config);
        const { geometries, materials } = this.extractGeometries(filtered);

        const usesDefault = this.resolveMatKey(config) === DEFAULT;
        const merged = merge(geometries, usesDefault);
        const mat = usesDefault ? materials : config.material;

        const mesh = new Mesh(merged, mat as any);
        (mesh as any).modelID = config.modelID;

        this.activeSelections[this.resolveMatKey(config)].mesh = mesh;
        config.scene.add(mesh);

        return mesh;
    }

    private isConfigUsable(config: HighlightConfig): boolean {
        return (
            config.scene != null &&
            config.modelID != null &&
            config.ids != null &&
            config.removePrevious != null
        );
    }

    private extractGeometries(filtered: GeometriesByMaterials) {
        const geometries: BufferGeometry[] = [];
        const materials: Material[] = [];

        for (const key of Object.keys(filtered)) {
            const entry = filtered[key];
            const geoList = Object.values(entry.geometries);

            if (!geoList.length) continue;

            materials.push(entry.material);
            geometries.push(
                geoList.length > 1 ? merge(geoList) : geoList[0]
            );
        }

        return { geometries, materials };
    }

    private prepareSelectionGroup(scene: Scene, config: HighlightConfig) {
        const key = this.resolveMatKey(config);
        const existing = this.activeSelections[key];

        if (!existing) {
            this.activeSelections[key] = {
                ids: new Set(config.ids),
                mesh: {} as Mesh
            };
            return;
        }

        scene.remove(existing.mesh);

        if (config.removePrevious) {
            existing.ids = new Set(config.ids);
        } else {
            config.ids.forEach(id => existing.ids.add(id));
        }
    }

    private isDuplicateSelection(config: HighlightConfig): boolean {
        const key = this.resolveMatKey(config);
        const current = this.activeSelections[key];
        if (!current) return false;

        const previousIds = Array.from(current.ids);
        if (this.isSubset(config.ids, previousIds)) return true;

        return JSON.stringify(config.ids) === JSON.stringify(previousIds);
    }

    private isSubset(newIds: number[], previous: number[]): boolean {
        let index = 0;
        return newIds.every(v => {
            index = previous.indexOf(v, index);
            return index++ !== -1;
        });
    }

    private appendSelection(config: HighlightConfig) {
        const key = this.resolveMatKey(config);
        const selection = this.activeSelections[key];

        const filtered = this.collectFilteredGeometries(config);
        const extraGeoms = Object.values(filtered)
            .flatMap(v => Object.values(v.geometries));

        selection.mesh.geometry = merge([
            selection.mesh.geometry,
            ...extraGeoms
        ]);

        config.ids.forEach(id => selection.ids.add(id));
    }

    private collectFilteredGeometries(
        config: HighlightConfig
    ): GeometriesByMaterials {
        const model = this.ifcState.models[config.modelID];
        const selected = new Set(config.ids);
        const result: GeometriesByMaterials = {};

        for (const matKey in model.items) {
            const entry = model.items[matKey];
            result[matKey] = {
                material: entry.material,
                geometries: this.pickGeometries(selected, entry.geometries)
            };
        }

        return result;
    }

    private pickGeometries(
        selected: Set<number>,
        geometries: IdGeometries
    ): IdGeometries {
        const out: IdGeometries = {};

        for (const key of Object.keys(geometries)) {
            const id = Number(key);
            if (selected.has(id)) {
                out[key] = geometries[key];
            }
        }

        return out;
    }

    private shouldAppend(config: HighlightConfig): boolean {
        const key = this.resolveMatKey(config);
        const defaultKey = this.buildKey(config.modelID);
        return (
            !config.removePrevious &&
            key !== defaultKey &&
            !!this.activeSelections[key]
        );
    }

    private resolveMatKey(config: HighlightConfig): string {
        const base = config.material?.uuid ?? DEFAULT;
        return `${base} - ${config.modelID}`;
    }

    private buildKey(modelID: number, material?: Material): string {
        const base = material?.uuid ?? DEFAULT;
        return `${base} - ${modelID}`;
    }
}
