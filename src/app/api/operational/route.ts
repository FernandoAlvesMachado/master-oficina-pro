import { NextRequest, NextResponse } from "next/server";
import { query, isDbConfigured } from "@/lib/db";
import { verifyRequestAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  if (!(await verifyRequestAuth(req))) {
    return NextResponse.json(
      { success: false, error: "Acesso não autorizado. Autenticação obrigatória." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json(
      { success: false, error: "tenantId é obrigatório." },
      { status: 400 }
    );
  }

  try {
    if (isDbConfigured()) {
      // 1. Busca dados da loja/oficina na tabela tenant_store
      const storeRes = await query(
        `SELECT vehicles, service_orders, clients, products, sales, receivables, payables, company_settings, updated_at
         FROM tenant_store
         WHERE tenant_id = $1`,
        [tenantId]
      );

      // 2. Busca fotos e checklists na tabela vehicle_checklists
      const checklistsRes = await query(
        `SELECT os_id, photos, fuel_level, damage_notes, tires_condition, updated_at
         FROM vehicle_checklists
         WHERE tenant_id = $1 OR tenant_id IS NULL`,
        [tenantId]
      );

      const store = storeRes[0] || {};
      const vehicles: any[] = Array.isArray(store.vehicles) ? store.vehicles : [];
      const serviceOrders: any[] = Array.isArray(store.service_orders) ? store.service_orders : [];
      const products: any[] = Array.isArray(store.products) ? store.products : [];
      const clients: any[] = Array.isArray(store.clients) ? store.clients : [];
      const receivables: any[] = Array.isArray(store.receivables) ? store.receivables : [];
      const sales: any[] = Array.isArray(store.sales) ? store.sales : [];
      const companySettings = store.company_settings || {};

      // Combina ordens de serviço tanto do array service_orders quanto de vehicles com O.S. ativa
      const allOrders: any[] = [];

      const getPhotosArray = (photosRaw: any): any[] => {
        if (Array.isArray(photosRaw)) return photosRaw;
        if (photosRaw && typeof photosRaw === "object") {
          return Object.entries(photosRaw).map(([key, val]: [string, any]) => {
            if (typeof val === "string") {
              return { url: val, description: key };
            }
            return { url: val?.url || val?.dataUrl || "", description: val?.description || key };
          });
        }
        return [];
      };

      // A) Veículos com O.S. ativa (formato do app mobile/web da oficina)
      vehicles.forEach((v: any, idx: number) => {
        if (v.currentOs || v.service || v.budgetTotal) {
          let inspectionPhotos = getPhotosArray(v.inspection?.photos);
          let fuelLevel = v.inspection?.fuelLevel || "1/2";
          let damageNotes = v.inspection?.damageNotes || "";
          let tiresCondition = v.inspection?.tiresCondition || "BOM";

          // Se a vistoria estiver na tabela vehicle_checklists, associa automaticamente
          if (inspectionPhotos.length === 0 && checklistsRes.length > 0) {
            const match =
              checklistsRes.find(
                (c: any) =>
                  c.os_id === v.currentOs ||
                  c.os_id === `OS-${v.currentOs}` ||
                  (v.currentOs && c.os_id && String(c.os_id).includes(String(v.currentOs)))
              ) || checklistsRes[0];

            if (match) {
              const extraPhotos = getPhotosArray(match.photos);
              if (extraPhotos.length > 0) {
                inspectionPhotos = extraPhotos;
              }
              if (match.fuel_level) fuelLevel = match.fuel_level;
              if (match.damage_notes) damageNotes = match.damage_notes;
              if (match.tires_condition) tiresCondition = match.tires_condition;
            }
          }

          allOrders.push({
            id: v.currentOs || `OS-${1000 + idx}`,
            vehicle: v.vehicleModel || `${v.brand || ""} ${v.model || ""}`.trim() || "Veículo",
            plate: v.plate || "S/ Placa",
            client: v.clientName || "Cliente",
            clientPhone: v.clientPhone || "",
            service: v.service || "Revisão e Manutenção",
            value: v.budgetTotal || "R$ 0,00",
            status: v.statusLabel || (v.status === "DONE" ? "Concluída" : "Em Execução"),
            statusColor: v.statusColor || (v.status === "DONE" ? "#10B981" : "#38BDF8"),
            photos: inspectionPhotos,
            photosCount: inspectionPhotos.length,
            inspection: v.inspection || null,
            fuelLevel,
            damageNotes,
            tiresCondition,
            estimatedTime: v.estimatedTime || "Hoje",
          });
        }
      });

      // B) Array dedicado service_orders (caso a oficina registre ordens separadamente)
      serviceOrders.forEach((os: any, idx: number) => {
        let osPhotos = getPhotosArray(os.photos);
        let fuelLevel = os.fuelLevel || "1/2";
        let damageNotes = os.damageNotes || "";
        let tiresCondition = os.tiresCondition || "BOM";

        if (osPhotos.length === 0 && checklistsRes.length > 0) {
          const match =
            checklistsRes.find(
              (c: any) =>
                c.os_id === (os.id || os.osNumber) ||
                (c.os_id && String(c.os_id).includes(String(os.id || os.osNumber)))
            ) || checklistsRes[0];

          if (match) {
            const extraPhotos = getPhotosArray(match.photos);
            if (extraPhotos.length > 0) {
              osPhotos = extraPhotos;
            }
            if (match.fuel_level) fuelLevel = match.fuel_level;
            if (match.damage_notes) damageNotes = match.damage_notes;
            if (match.tires_condition) tiresCondition = match.tires_condition;
          }
        }

        allOrders.push({
          id: os.id || os.osNumber || `OS-${2000 + idx}`,
          vehicle: os.vehicle || os.carModel || "Veículo",
          plate: os.plate || "S/ Placa",
          client: os.clientName || os.client || "Cliente",
          clientPhone: os.clientPhone || "",
          service: os.serviceDescription || os.service || "Serviço",
          value: typeof os.totalValue === "number"
            ? os.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
            : os.totalValue || os.value || "R$ 0,00",
          status: os.status || "Em Andamento",
          statusColor:
            os.status === "FINALIZADA" || os.status === "PRONTO" || os.status === "CONCLUIDA"
              ? "#10B981"
              : "#38BDF8",
          photos: osPhotos,
          photosCount: osPhotos.length,
          inspection: os.inspection || null,
          fuelLevel,
          damageNotes,
          tiresCondition,
          estimatedTime: os.estimatedTime || "Hoje",
        });
      });

      // Cálculos das métricas operacionais
      const activeOsCount = allOrders.filter(
        (o) =>
          !String(o.status).toLowerCase().includes("conclu") &&
          !String(o.status).toLowerCase().includes("finaliz") &&
          !String(o.status).toLowerCase().includes("entreg") &&
          !String(o.status).toLowerCase().includes("pronto")
      ).length;

      const completedOsCount = allOrders.filter(
        (o) =>
          String(o.status).toLowerCase().includes("conclu") ||
          String(o.status).toLowerCase().includes("finaliz") ||
          String(o.status).toLowerCase().includes("entreg") ||
          String(o.status).toLowerCase().includes("pronto")
      ).length;

      // Helper para converter valores monetários em formato PT-BR para número
      const parseBRL = (val: any): number => {
        if (typeof val === "number") return val;
        if (!val) return 0;
        const cleaned = String(val)
          .replace(/[^\d,-]/g, "")
          .replace(",", ".");
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
      };

      // Cálculo de faturamento mensal
      let totalRevenueNum = 0;
      receivables.forEach((r: any) => {
        totalRevenueNum += parseBRL(r.amount);
      });

      if (totalRevenueNum === 0) {
        allOrders.forEach((o) => {
          totalRevenueNum += parseBRL(o.value);
        });
      }

      // Soma de fotos de vistoria (de ordens + vehicle_checklists)
      let totalPhotosCount = 0;
      allOrders.forEach((o) => {
        totalPhotosCount += Number(o.photosCount || 0);
      });
      checklistsRes.forEach((c: any) => {
        const cPhotos = Array.isArray(c.photos)
          ? c.photos.length
          : c.photos
          ? Object.keys(c.photos).length
          : 0;
        totalPhotosCount += cPhotos;
      });

      // Estoque de Peças
      const stockItemsCount = products.length;
      const lowStockCount = products.filter((p: any) => {
        const stock = Number(p.stock || p.quantity || 0);
        const minStock = Number(p.minStock || 5);
        return stock <= minStock;
      }).length;

      const hasRealData =
        allOrders.length > 0 ||
        products.length > 0 ||
        clients.length > 0 ||
        vehicles.length > 0;

      return NextResponse.json({
        success: true,
        data: {
          metrics: {
            activeOsCount,
            completedOsCount,
            monthlyRevenue: totalRevenueNum.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            }),
            totalPhotosCount,
            stockItemsCount,
            lowStockCount,
            clientsCount: clients.length,
            vehiclesCount: vehicles.length,
          },
          serviceOrders: allOrders,
          products: products.slice(0, 10),
          companySettings,
          hasRealData,
        },
      });
    }
  } catch (err: any) {
    console.error("[OPERATIONAL API ERROR]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: {
      metrics: {
        activeOsCount: 0,
        completedOsCount: 0,
        monthlyRevenue: "R$ 0,00",
        totalPhotosCount: 0,
        stockItemsCount: 0,
        lowStockCount: 0,
        clientsCount: 0,
        vehiclesCount: 0,
      },
      serviceOrders: [],
      products: [],
      companySettings: {},
      hasRealData: false,
    },
  });
}
