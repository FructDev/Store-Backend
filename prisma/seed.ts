// prisma/seed.ts (Con Tipado Explícito)
import { PrismaClient, Permission, Prisma } from '../generated/prisma'; // <-- AJUSTA RUTA e importa Prisma y Permission

const prisma = new PrismaClient();

// Definimos explícitamente el tipo para los datos de entrada de permisos
type PermissionInputData = Omit<
  Prisma.PermissionCreateInput,
  'id' | 'createdAt' | 'updatedAt' | 'roles'
>;

async function main() {
  console.log(`Start seeding ...`);

  // --- Crear Roles --- (Sin cambios)
  const rolesData = [
    { name: 'STORE_ADMIN', description: 'Administrador de Tienda' },
    { name: 'SALESPERSON', description: 'Vendedor' },
    { name: 'TECHNICIAN', description: 'Técnico de Reparaciones' },
  ];
  console.log('Creating roles...');
  const roles = await Promise.all(
    rolesData.map((role) =>
      prisma.role.upsert({
        where: { name: role.name },
        update: {},
        create: role,
      }),
    ),
  );
  const roleMap = new Map(roles.map((r) => [r.name, r.id]));
  console.log(`Roles created: ${roles.map((r) => r.name).join(', ')}`);

  // --- Crear Permisos ---
  // Tipamos explícitamente el array de datos de entrada
  const permissionsData: PermissionInputData[] = [
    {
      action: 'manage',
      subject: 'User',
      description: 'Gestionar usuarios de la tienda',
    },
    {
      action: 'manage',
      subject: 'Product',
      description: 'Gestionar productos e inventario',
    },
    {
      action: 'read',
      subject: 'Product',
      description: 'Ver productos e inventario',
    },
    { action: 'create', subject: 'Sale', description: 'Crear ventas' },
    { action: 'read', subject: 'Sale', description: 'Ver ventas' },
    {
      action: 'manage',
      subject: 'Customer',
      description: 'Gestionar clientes',
    },
    {
      action: 'manage',
      subject: 'Repair',
      description: 'Gestionar reparaciones',
    },
    { action: 'read', subject: 'Repair', description: 'Ver reparaciones' },
    { action: 'read', subject: 'Report', description: 'Ver reportes' },
  ];
  console.log('Creating permissions...');

  // Tipamos explícitamente el resultado esperado de Promise.all y el parámetro del map
  const permissions: Permission[] = await Promise.all(
    permissionsData.map(
      async (perm: PermissionInputData): Promise<Permission> => {
        // Ahora 'perm' tiene el tipo correcto y TS no debería inferir 'never'
        return prisma.permission.upsert({
          where: {
            action_subject: { action: perm.action, subject: perm.subject },
          },
          update: { description: perm.description },
          create: perm,
        });
      },
    ),
  );

  // --- El resto del script (Logs, creación de Mapa, conexión de permisos) ---
  // ... (Mantenemos los logs de depuración y la lógica de población explícita del mapa) ...
  console.log('\n--- Raw Permissions Array (Result of Promise.all) ---');
  console.log(JSON.stringify(permissions, null, 2));
  console.log('--- End Raw Permissions Array ---');

  console.log('\n--- Populating Permission Map Explicitly ---');
  const permissionMap = new Map<string, string>();
  for (const p of permissions) {
    if (p && p.action && p.subject && p.id) {
      const key = `${p.action}:${p.subject}`;
      permissionMap.set(key, p.id);
      console.log(`Map SET: Key='${key}', ID='${p.id}'`);
    } else {
      console.warn('Skipping...', p);
    }
  }
  console.log('--- End Populating Map ---');
  console.log(`Permission Map final size: ${permissionMap.size}`);
  console.log('\n--- Permission Map Contents (After Explicit Population) ---');
  permissionMap.forEach((value, key) => {
    console.log(`'${key}': '${value}'`);
  });
  console.log('--- End Permission Map ---');
  console.log(`Permissions created/found: ${permissions.length}`);

  console.log('\nConnecting permissions to roles...');

  // STORE_ADMIN
  const adminPermissionsKeys = [
    'manage:User',
    'manage:Product',
    'read:Product',
    'create:Sale',
    'read:Sale',
    'manage:Customer',
    'manage:Repair',
    'read:Repair',
    'read:Report',
    // Asegúrate que estos strings coincidan EXACTAMENTE con los 'action:subject' de tu permissionsData
  ];

  console.log('\n--- Processing STORE_ADMIN ---');
  const adminConnectPayload = adminPermissionsKeys.map((pKey) => ({
    id: permissionMap.get(pKey),
  }));
  // Tipamos explícitamente 'p' en el filter y usamos un type predicate
  const validAdminConnectPayload = adminConnectPayload.filter(
    (p: { id: string | undefined }): p is { id: string } => p.id !== undefined,
  );
  if (validAdminConnectPayload.length !== adminPermissionsKeys.length) {
    console.warn(`WARNING: Only ${validAdminConnectPayload.length}...`);
  }
  if (roleMap.has('STORE_ADMIN') && validAdminConnectPayload.length > 0) {
    await prisma.role.update({
      where: { id: roleMap.get('STORE_ADMIN')! },
      data: { permissions: { connect: validAdminConnectPayload } },
    });
    console.log(`Connected ${validAdminConnectPayload.length}...`);
  } else {
    /* ... */
  }

  // SALESPERSON (Aplicar mismo tipado explícito en filter)
  const salespersonPermissionsKeys = [
    'create:Sale',
    'read:Sale',
    'manage:Customer', // Quizás solo 'create:Customer', 'read:Customer', 'update:Customer'?
    'read:Product', // Para ver qué vender
    'read:Repair', // Para consultar estado de reparación de cliente
  ];
  console.log('\n--- Processing SALESPERSON ---');
  const salespersonConnectPayload = salespersonPermissionsKeys.map((pKey) => ({
    id: permissionMap.get(pKey),
  }));
  const validSalespersonConnectPayload = salespersonConnectPayload.filter(
    (p: { id: string | undefined }): p is { id: string } => p.id !== undefined,
  );
  if (
    validSalespersonConnectPayload.length !== salespersonPermissionsKeys.length
  ) {
    console.warn(`WARNING: Only ${validSalespersonConnectPayload.length}...`);
  }
  if (roleMap.has('SALESPERSON') && validSalespersonConnectPayload.length > 0) {
    await prisma.role.update({
      where: { id: roleMap.get('SALESPERSON')! },
      data: { permissions: { connect: validSalespersonConnectPayload } },
    });
    console.log(`Connected ${validSalespersonConnectPayload.length}...`);
  } else {
    /* ... */
  }

  // TECHNICIAN (Aplicar mismo tipado explícito en filter)
  const technicianPermissionsKeys = [
    'manage:Repair', // O quizás 'update:Repair' y 'read:Repair' más específico
    'read:Repair',
    'read:Product', // Para ver repuestos
    // Quizás un permiso para "consumir:StockPart"
  ];
  console.log('\n--- Processing TECHNICIAN ---');
  const technicianConnectPayload = technicianPermissionsKeys.map((pKey) => ({
    id: permissionMap.get(pKey),
  }));
  const validTechnicianConnectPayload = technicianConnectPayload.filter(
    (p: { id: string | undefined }): p is { id: string } => p.id !== undefined,
  );
  if (
    validTechnicianConnectPayload.length !== technicianPermissionsKeys.length
  ) {
    console.warn(`WARNING: Only ${validTechnicianConnectPayload.length}...`);
  }
  if (roleMap.has('TECHNICIAN') && validTechnicianConnectPayload.length > 0) {
    await prisma.role.update({
      where: { id: roleMap.get('TECHNICIAN')! },
      data: { permissions: { connect: validTechnicianConnectPayload } },
    });
    console.log(`Connected ${validTechnicianConnectPayload.length}...`);
  } else {
    /* ... */
  }

  console.log(`\nSeeding finished.`);
}

main()
  .catch(async (e) => {
    console.error('Error during seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  })
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  .finally(async () => {
    await prisma.$disconnect();
    console.log('Prisma client disconnected.');
  });
