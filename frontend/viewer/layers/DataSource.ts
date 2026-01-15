import * as shapefile from "shapefile";
import { DataSourceTypes } from "./DataSourceTypes";
import DataSourceProperty from "./DataSourceProperty";
import { makeAutoObservable, toJS } from "mobx";
import parseGeoJSON from "./utils/parse-geojson";
import * as localforage from "localforage";

export default class DataSourceModel {
    public id = "";
    public label: string;
    public sourceType: DataSourceTypes;

    public properties: DataSourceProperty[] = [];
    public features: object[] = [];
    public rawData: any;

    public allowCache = true;
    public isDemo = false;

    public isLoaded = false;
    public cached = false;

    constructor(id: string, name: string, type: DataSourceTypes) {
        this.id = id;
        this.label = name;
        this.sourceType = type;
        makeAutoObservable(this);
    }

    get snapshot() {
        return toJS(this.rawData);
    }

    async load(data: any) {
        if (!data) return;

        if (this.sourceType === "shp") {
            await this.loadFromShapefile(data);
            return;
        }

        if (this.sourceType === "geojson") {
            await this.loadFromGeoJSON(data);
        }
    }

    // =====================
    // Internal loaders
    // =====================

    private async loadFromShapefile(input: any) {
        const source = await shapefile.read(input);
        const { properties, features } = parseGeoJSON(source);

        this.assignData(properties, features);
        await this.persist();
    }

    private async loadFromGeoJSON(input: any) {
        if (input instanceof File) {
            await this.readFile(input);
            return;
        }

        const { properties, features } = parseGeoJSON(input);
        this.assignData(properties, features);

        if (this.allowCache) {
            await this.persist();
        }
    }

    private readFile(file: File): Promise<void> {
        return new Promise(resolve => {
            const reader = new FileReader();

            reader.onload = async () => {
                const content = reader.result;
                const { properties, features } = parseGeoJSON(content);

                this.assignData(properties, features);

                if (this.allowCache) {
                    await this.persist();
                }

                resolve();
            };

            reader.readAsText(file);
        });
    }

    private assignData(
        properties: DataSourceProperty[],
        features: object[]
    ) {
        this.properties = properties;
        this.features = features;

        this.rawData = {
            type: "FeatureCollection",
            features: this.features
        };

        this.isLoaded = true;
    }

    // =====================
    // Caching
    // =====================

    private async persist() {
        await localforage.setItem(`datasource-${this.id}`, {
            id: this.id,
            name: this.label,
            type: this.sourceType,
            features: toJS(this.features),
            properties: toJS(this.properties)
        });

        this.cached = true;
    }
}
