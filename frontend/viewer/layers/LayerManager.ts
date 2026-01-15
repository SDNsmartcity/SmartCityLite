import GeoJsonLayer from "./GeoJsonLayer";
import { Theme } from "@here/harp-datasource-protocol";
import { MapView } from "@here/harp-mapview";
import { makeAutoObservable } from "mobx";
import DataSource from "./DataSource";
import Viewer from "../viewer";
import localforage from "localforage";
import { DataSourceTypes } from "./DataSourceTypes";

const S3_BASE =
    "https://cassini-hackathon-resources.s3.eu-central-1.amazonaws.com";
const GITHUB_BASE =
    "https://raw.githubusercontent.com/Parametricos/citylite-smartcities-cassini-hackathon-2021/main/assets/layers";

const DEMO_SOURCES = [
    {
        id: "san_francisco_neighborhoods",
        title: "USA - San Francisco - Neighborhood Boundaries",
        type: "geojson",
        region: "USA",
        updatedAt: "18 June 2021",
        endpoint: `${S3_BASE}/layers/san_francisco_neighborhoods.json`
    },
    {
        id: "limassol_ndvi",
        title:
            "Cyprus - Limassol - Normalized Difference Vegetation Index (NDVI)",
        type: "geojson",
        region: "Cyprus",
        updatedAt: "18 June 2021",
        endpoint: `${S3_BASE}/layers/limassol_ndvi.geojson`
    },
    {
        id: "cyprusfire_20210703",
        title: "Cyprus - Fire - Emergency 2021.07.02",
        type: "geojson",
        region: "Cyprus",
        updatedAt: "03 July 2021",
        endpoint: `${GITHUB_BASE}/20210703_CyprusFire-EPSG.geojson`
    },
    {
        id: "cyprusfirehousing_20210703",
        title: "Cyprus - Fire - Housing 2021.07.02",
        type: "geojson",
        region: "Cyprus",
        updatedAt: "03 July 2021",
        endpoint: `${GITHUB_BASE}/20210703_Cadastral-Buildings-CyprusFire-EPSG.geojson`
    }
];

export default class MapLayerRegistry {
    readonly viewer: Viewer;
    readonly mapView: MapView;
    readonly theme: Theme;

    sources: DataSource[] = [];
    activeLayers: GeoJsonLayer[] = [];

    constructor(viewer: Viewer, theme: Theme) {
        this.viewer = viewer;
        this.mapView = viewer.map;
        this.theme = theme;

        makeAutoObservable(this);

        this.restoreCachedSources();
        this.bootstrapDemoSources();
    }

    // =====================
    // Layer handling
    // =====================

    async registerLayer(layer: GeoJsonLayer) {
        this.activeLayers.push(layer);

        const styleMap: Record<string, any> = {};
        for (const l of this.activeLayers) {
            styleMap[l.id] = l.styleSet;
        }

        await this.viewer.setThemeStyles(styleMap);

        const harpSource = layer.harpFeaturesDataSource;
        if (!harpSource) {
            console.warn("Layer datasource not initialized");
            return;
        }

        await this.mapView.addDataSource(harpSource);
        return layer;
    }

    unregisterLayer(layer: GeoJsonLayer) {
        const harpSource = layer.harpFeaturesDataSource;
        if (!harpSource) {
            console.warn("Layer datasource not initialized");
            return;
        }

        this.mapView.removeDataSource(harpSource);

        const idx = this.activeLayers.indexOf(layer);
        if (idx >= 0) {
            this.activeLayers.splice(idx, 1);
        }
    }

    // =====================
    // Data sources
    // =====================

    findSource(id: string) {
        return this.sources.find(src => src.id === id);
    }

    async bootstrapDemoSources() {
        for (const demo of DEMO_SOURCES) {
            try {
                const response = await fetch(demo.endpoint);
                const payload = await response.json();

                const source = new DataSource(
                    demo.id,
                    demo.title,
                    demo.type as DataSourceTypes
                );

                source.cachable = false;
                source.demo = true;

                await source.setData(payload);
                this.sources.push(source);
            } catch (err) {
                console.error("Failed to load demo datasource", err);
            }
        }
    }

    restoreCachedSources() {
        localforage
            .iterate((stored: any, key: string) => {
                if (!key.startsWith("datasource-")) return;

                const source = new DataSource(
                    stored.id,
                    stored.name,
                    stored.type
                );

                source.features = stored.features;
                source.properties = stored.properties;
                source.data = {
                    type: "FeatureCollection",
                    features: stored.features
                };

                source.loaded = true;
                this.sources.push(source);
            })
            .then(() => {
                console.info("Cached data sources restored");
            })
            .catch(err => {
                console.error("Failed restoring cached data sources", err);
            });
    }

    async removeSource(id: string) {
        const index = this.sources.findIndex(src => src.id === id);
        if (index === -1) return;

        await localforage.removeItem(`datasource-${id}`);
        this.sources.splice(index, 1);
    }
}
