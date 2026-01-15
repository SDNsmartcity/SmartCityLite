import Viewer from "../viewer";
import Model from "./Model";
import { makeAutoObservable } from "mobx";

export default class SceneModelRegistry {
    private viewerRef: Viewer;
    registeredModels: Model[] = [];

    constructor(viewer: Viewer) {
        this.viewerRef = viewer;
        makeAutoObservable(this);
    }

    register(model: Model) {
        const map = this.viewerRef.map;

        map.mapAnchors.add(model.mapAnchor);

        map.lookAt({
            target: model.geoPosition,
            tilt: 60,
            zoomLevel: 19
        });

        this.registeredModels.push(model);
    }
}
