/**
 * Compara existencias de Huatabampo, Navojoa y Matriz contra el kardex.
 * Uso: npx tsx scripts/restore-branch-inventory.ts [--apply]
 */
import { cleanupStaleBranchKeys, persistInventoryRestore, fetchInventoryRestoreSources } from '../src/lib/firebase';
import { planInventoryRestore, summarizeRestoreActions } from '../src/lib/inventoryRestore';

const apply = process.argv.includes('--apply');

async function main() {
  if (apply) {
    const stripped = await cleanupStaleBranchKeys();
    if (stripped) console.log(`Se quitaron claves viejas de sucursal (Bodega, etc.) en ${stripped} productos.`);
  }
  const sources = await fetchInventoryRestoreSources();
  const report = planInventoryRestore(sources.products, sources.movements, sources.tickets);
  const byBranch = summarizeRestoreActions(report.actions);

  console.log(
    JSON.stringify(
      {
        apply,
        movements: report.movementCount,
        tickets: report.ticketCount,
        current: report.current,
        kardex: report.kardex,
        corrections: byBranch,
        count: report.actions.length,
        plan: report.actions
      },
      null,
      2
    )
  );

  if (apply && report.actions.length > 0) {
    await persistInventoryRestore(sources.products, report.actions, 'Sistema');
    console.log(`Aplicadas ${report.actions.length} correcciones.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
