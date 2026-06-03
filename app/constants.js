export const LEAF_TYPES = ['ticket', 'issue', 'conversation'];

export const FIELD_TYPE_LABELS = {
  id: 'ID Reference',
  text: 'Text',
  tokens: 'Tokens',
  bool: 'Boolean',
  int: 'Integer',
  double: 'Double',
  timestamp: 'Timestamp',
  enum: 'Enum',
  uenum: 'User Enum',
  array: 'Array',
  struct: 'Struct',
  composite: 'Composite',
  unknown: 'Unknown',
};

export const FRAGMENT_TYPES = {
  TENANT: 'tenant_fragment',
  CUSTOM_TYPE: 'custom_type_fragment',
  APP: 'app_fragment',
};

export const TABS = [
  { id: 'schemas', label: 'Schema Explorer', icon: 'database' },
  { id: 'fields', label: 'Field Management', icon: 'sliders' },
  { id: 'parts-groups', label: 'Parts & Groups', icon: 'layers' },
  { id: 'dependencies', label: 'Dependencies', icon: 'git-branch' },
  { id: 'rules', label: 'Conditional Rules', icon: 'shield' },
];
