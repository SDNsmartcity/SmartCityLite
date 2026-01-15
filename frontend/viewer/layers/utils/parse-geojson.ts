import DataSourceProperty from "../DataSourceProperty";
import StringDataSourceProperty from "../StringDataSourceProperty";
import NumberDataSourceProperty from "../NumberDataSourceProperty";

type ParseResult = {
    properties: DataSourceProperty[];
    features: object[];
};

export default function parseGeoJSON(input: any): ParseResult {
    const geojson =
        typeof input === "string" ? JSON.parse(input) : input;

    if (geojson?.type !== "FeatureCollection") {
        console.warn("Input is not a FeatureCollection");
        return { properties: [], features: [] };
    }

    return processFeatures(geojson.features);
}

function processFeatures(featuresList: any[]): ParseResult {
    const collectedProps: DataSourceProperty[] = [];
    const collectedFeatures: object[] = [];

    for (const feature of featuresList) {
        collectedFeatures.push(feature);
        extractProperties(feature.properties, collectedProps);
    }

    return {
        features: collectedFeatures,
        properties: collectedProps
    };
}

function extractProperties(
    props: Record<string, any>,
    registry: DataSourceProperty[]
) {
    for (const [key, value] of Object.entries(props)) {
        if (value === undefined) continue;

        const existing = registry.find(p => p.name === key);
        const valueType = typeof value;

        if (valueType === "number") {
            handleNumber(key, value, existing, registry);
            continue;
        }

        if (valueType === "string") {
            if (!existing) {
                registry.push(new StringDataSourceProperty(key));
            }
            continue;
        }
    }
}

function handleNumber(
    key: string,
    value: number,
    existing: DataSourceProperty | undefined,
    registry: DataSourceProperty[]
) {
    if (!existing) {
        const prop = new NumberDataSourceProperty(key);
        prop.expandRange(value);
        registry.push(prop);
        return;
    }

    (existing as NumberDataSourceProperty).expandRange(value);
}
