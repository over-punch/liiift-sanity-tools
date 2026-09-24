// Test schemas for input components — AdvancedRefArray, KeyValueInput, NestedObjectArraySelector
import { AdvancedRefArray } from '../../sanity-advanced-reference-array/src';
import { KeyValueInput } from '../../sanity-key-value-input/src';
import { NestedObjectArraySelector } from '../../sanity-nested-object-selector/src';

const inputTestSchema = {
	name: 'inputTest',
	title: 'Input Components Test',
	type: 'document',
	fields: [
		{
			name: 'title',
			title: 'Title',
			type: 'string',
			validation: (Rule: any) => Rule.required(),
		},
		{
			name: 'advancedRefs',
			title: 'Advanced Reference Array',
			description: 'Tests @overpunch/sanity-advanced-reference-array',
			type: 'array',
			components: { input: AdvancedRefArray },
			of: [
				{
					type: 'reference',
					to: [{ type: 'inputTest' }, { type: 'referenceTest' }, { type: 'font' }],
				},
			],
		},
		{
			name: 'keyValues',
			title: 'Key-Value Pairs',
			description: 'Tests @overpunch/sanity-key-value-input',
			type: 'array',
			components: { input: KeyValueInput },
			of: [
				{
					type: 'object',
					fields: [
						{ name: 'key', title: 'Key', type: 'string' },
						{ name: 'value', title: 'Value', type: 'string' },
					],
				},
			],
		},
		{
			name: 'nestedObjects',
			title: 'Nested Object Selector',
			description: 'Tests @overpunch/sanity-nested-object-selector',
			type: 'array',
			components: { input: NestedObjectArraySelector },
			of: [
				{
					type: 'object',
					fields: [
						{ name: 'label', title: 'Label', type: 'string' },
						{
							name: 'children',
							title: 'Children',
							type: 'array',
							of: [
								{
									type: 'object',
									fields: [
										{ name: 'childLabel', title: 'Child Label', type: 'string' },
										{ name: 'childValue', title: 'Child Value', type: 'string' },
									],
								},
							],
						},
					],
				},
			],
		},
	],
};

export const inputTestSchemas = [inputTestSchema];
