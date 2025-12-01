// Schema helper functions for db_schema.json
import dbSchema from './db_schema.json';

export interface SchemaField {
  field_data_type: string;
  field_description: string;
  field_sample_values: any[];
  field_unique_values: string | any[];
  field_uniqueness_percent: number;
}

export interface SchemaTable {
  table_description: string;
  fields: {
    [fieldName: string]: SchemaField;
  };
}

export interface SchemaData {
  [tableName: string]: SchemaTable;
}

// Type the imported schema
const typedSchema = dbSchema as SchemaData;

/**
 * Get all table names from the schema
 */
export function getTableNames(): string[] {
  return Object.keys(typedSchema);
}

/**
 * Get schema for a specific table
 */
export function getTableSchema(tableName: string): SchemaTable | null {
  return typedSchema[tableName] || null;
}

/**
 * Get all fields for a specific table
 */
export function getTableFields(tableName: string): { [fieldName: string]: SchemaField } | null {
  const table = getTableSchema(tableName);
  return table ? table.fields : null;
}

/**
 * Get a specific field from a table
 */
export function getField(tableName: string, fieldName: string): SchemaField | null {
  const fields = getTableFields(tableName);
  return fields ? fields[fieldName] || null : null;
}

/**
 * Get unique values for a field (if it's an array)
 */
export function getFieldUniqueValues(tableName: string, fieldName: string): any[] {
  const field = getField(tableName, fieldName);
  if (!field) return [];
  
  // If field_unique_values is an array, return it
  if (Array.isArray(field.field_unique_values)) {
    return field.field_unique_values;
  }
  
  // Otherwise, return sample values
  return field.field_sample_values || [];
}

/**
 * Check if a field has enumerated values (dropdown-suitable)
 */
export function isEnumField(tableName: string, fieldName: string): boolean {
  const field = getField(tableName, fieldName);
  if (!field) return false;
  
  // Object type with unique values array
  return field.field_data_type === 'object' && Array.isArray(field.field_unique_values);
}

/**
 * Check if a field is numeric (int or float)
 */
export function isNumericField(tableName: string, fieldName: string): boolean {
  const field = getField(tableName, fieldName);
  if (!field) return false;
  
  return field.field_data_type === 'int64' || field.field_data_type === 'float64';
}

/**
 * Get the data type of a field
 */
export function getFieldDataType(tableName: string, fieldName: string): string | null {
  const field = getField(tableName, fieldName);
  return field ? field.field_data_type : null;
}

/**
 * Convert schema to DatabaseTable format for DatabaseExplorer
 */
export function convertSchemaToTables() {
  const tables = getTableNames().map(tableName => {
    const tableSchema = getTableSchema(tableName);
    if (!tableSchema) return null;

    const fields = tableSchema.fields;
    const columns = Object.entries(fields).map(([fieldName, fieldData]) => {
      const column: any = {
        name: fieldName,
        type: fieldData.field_data_type,
        description: fieldData.field_description,
      };

      // Add values if available
      if (Array.isArray(fieldData.field_unique_values)) {
        column.values = fieldData.field_unique_values;
      } else if (fieldData.field_sample_values && fieldData.field_sample_values.length > 0) {
        column.sample_values = fieldData.field_sample_values;
      }

      // Add range info for numeric fields
      if (fieldData.field_data_type === 'int64' || fieldData.field_data_type === 'float64') {
        const samples = fieldData.field_sample_values;
        if (samples && samples.length > 0) {
          column.min = Math.min(...samples);
          column.max = Math.max(...samples);
        }
      }

      column.uniqueness_percent = fieldData.field_uniqueness_percent;

      return column;
    });

    return {
      name: tableName,
      description: tableSchema.table_description,
      record_count: 0, // We don't have this in the schema
      columns,
    };
  }).filter(Boolean);

  return tables;
}

/**
 * Get filterable fields (exclude IDs and very high uniqueness fields)
 */
export function getFilterableFields(tableName: string): Array<{
  fieldName: string;
  field: SchemaField;
}> {
  const fields = getTableFields(tableName);
  if (!fields) return [];

  return Object.entries(fields)
    .filter(([fieldName, fieldData]) => {
      // Exclude ID fields
      if (fieldName.toLowerCase().includes('_id') || fieldName.toLowerCase() === 'id') {
        return false;
      }
      
      // Exclude fields with 100% uniqueness (likely identifiers)
      if (fieldData.field_uniqueness_percent === 100) {
        return false;
      }

      return true;
    })
    .map(([fieldName, field]) => ({ fieldName, field }));
}

export default typedSchema;
