export const CUSTOM_COMMODITIES_KEY = 'agri_custom_commodities';

export type CommodityCategory = {
    label: string;
    items: string[];
};

export const commodityCategories: CommodityCategory[] = [
    {
        label: '🥬 High Value Crops (Vegetables)',
        items: [
            'Baguio Beans (Per Kg.)',
            'Beans (Per Kg.)',
            'Broccoli (Per Kg.)',
            'Cabbage (Per Kg.)',
            'Camote (Per Kg.)',
            'Carrots (Per Kg.)',
            'Cauliflower (Per Kg.)',
            'Cucumber (Per Kg.)',
            'Dragonfruit (Per Kg.)',
            'Eggplant (Per Kg.)',
            'Ginger (Per Kg.)',
            'Green Onion (Per Kg.)',
            'Lettuce (Per Kg.)',
            'Paitan (Per Kg.)',
            'Peas (Per Kg.)',
            'Pechay (Per Kg.)',
            'Pepper (Per Kg.)',
            'Potato (Per Kg.)',
            'Radish (Per Kg.)',
            'Sayote (Per Kg.)',
            'Squash (Per Kg.)',
            'Tomato (Per Kg.)',
        ],
    },
    {
        label: '🌾 Rice & Corn',
        items: [
            'Corn (Per Kg.)',
            'Rice (Per Kg.)',
        ],
    },
];

// Flat list of all default commodities for backward compatibility
export const defaultCommodities = commodityCategories.flatMap(cat => cat.items);

// For backward compatibility
export const commodities = [...defaultCommodities];
