import { IdAttrName, Node, IfcState } from './BaseDefinitions';
import {
    IFCPROJECT,
    IFCRELAGGREGATES,
    IFCRELCONTAINEDINSPATIALSTRUCTURE,
    IFCRELDEFINESBYPROPERTIES,
    IFCRELDEFINESBYTYPE
} from 'web-ifc';
import { BufferGeometry } from 'three';

export class IfcPropertyResolver {
    private state: IfcState;

    constructor(state: IfcState) {
        this.state = state;
    }

    /** Resolve expressID from geometry + face index */
    extractExpressId(
        geometry: BufferGeometry,
        faceIndex: number
    ): number | undefined {
        if (!geometry.index) return;

        const indices = geometry.index.array;
        const idAttr = geometry.attributes[IdAttrName];
        return idAttr.getX(indices[faceIndex * 3]);
    }

    /** Fetch a single IFC line */
    getEntity(modelID: number, expressID: number, recursive = false) {
        return this.state.api.GetLine(modelID, expressID, recursive);
    }

    /** Fetch all entities or IDs of a given IFC type */
    getEntitiesByType(
        modelID: number,
        ifcType: number,
        expanded = false
    ) {
        const ids = this.collectIdsByType(modelID, ifcType);
        return expanded
            ? ids.map(id => this.state.api.GetLine(modelID, id))
            : ids;
    }

    /** Retrieve property sets attached to an element */
    getPropertySets(
        modelID: number,
        elementID: number,
        recursive = false
    ) {
        const relatedIds = this.resolveRelations(
            modelID,
            elementID,
            IFCRELDEFINESBYPROPERTIES,
            'RelatedObjects',
            'RelatingPropertyDefinition'
        );

        return relatedIds.map(id =>
            this.state.api.GetLine(modelID, id, recursive)
        );
    }

    /** Retrieve type definitions attached to an element */
    getTypeDefinitions(
        modelID: number,
        elementID: number,
        recursive = false
    ) {
        const relatedIds = this.resolveRelations(
            modelID,
            elementID,
            IFCRELDEFINESBYTYPE,
            'RelatedObjects',
            'RelatingType'
        );

        return relatedIds.map(id =>
            this.state.api.GetLine(modelID, id, recursive)
        );
    }

    /** Build spatial hierarchy starting from IFCPROJECT */
    buildSpatialTree(modelID: number, recursive: boolean) {
        const [projectId] = this.collectIdsByType(modelID, IFCPROJECT);
        const project = this.state.api.GetLine(modelID, projectId);
        this.populateSpatialNodes(modelID, project, recursive);
        return project;
    }

    // =====================
    // Internal helpers
    // =====================

    private collectIdsByType(modelID: number, type: number): number[] {
        const result: number[] = [];
        const lines = this.state.api.GetLineIDsWithType(modelID, type);

        for (let i = 0; i < lines.size(); i++) {
            result.push(lines.get(i));
        }

        return result;
    }

    private populateSpatialNodes(
        modelID: number,
        node: Node,
        recursive: boolean
    ) {
        node.hasChildren = [];
        node.hasSpatialChildren = [];

        this.attachRelatedNodes(
            modelID,
            node.expressID,
            node.hasSpatialChildren,
            IFCRELAGGREGATES,
            'RelatingObject',
            'RelatedObjects',
            recursive,
            true
        );

        this.attachRelatedNodes(
            modelID,
            node.expressID,
            node.hasChildren,
            IFCRELCONTAINEDINSPATIALSTRUCTURE,
            'RelatingStructure',
            'RelatedElements',
            recursive,
            false
        );
    }

    private attachRelatedNodes(
        modelID: number,
        sourceID: number,
        targetArray: Node[],
        relationType: number,
        sourceKey: string,
        targetKey: string,
        recursive: boolean,
        spatialOnly: boolean
    ) {
        const relatedIds = this.resolveRelations(
            modelID,
            sourceID,
            relationType,
            sourceKey,
            targetKey
        );

        if (!recursive && !spatialOnly) {
            targetArray.push(...(relatedIds as any));
            return;
        }

        const nodes = relatedIds.map(id =>
            this.state.api.GetLine(modelID, id, false)
        );

        targetArray.push(...nodes);

        for (const child of nodes) {
            this.populateSpatialNodes(modelID, child, recursive);
        }
    }

    private resolveRelations(
        modelID: number,
        elementID: number,
        relationType: number,
        relationKey: string,
        resultKey: string
    ): number[] {
        const relations = this.collectIdsByType(modelID, relationType);
        const resolved: number[] = [];

        for (const relID of relations) {
            const rel = this.state.api.GetLine(modelID, relID);
            const related = rel[relationKey];

            const matches = Array.isArray(related)
                ? related.some((r: any) => r.value === elementID)
                : related.value === elementID;

            if (!matches) continue;

            const target = rel[resultKey];
            if (Array.isArray(target)) {
                target.forEach((t: any) => resolved.push(t.value));
            } else {
                resolved.push(target.value);
            }
        }

        return resolved;
    }
}
