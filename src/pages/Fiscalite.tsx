import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LayoutDashboard, Calendar, FileText, Settings, CalendarDays } from "lucide-react";
import FiscaliteDashboard from "@/components/fiscalite/FiscaliteDashboard";
import CalendrierFiscal from "@/components/fiscalite/CalendrierFiscal";
import TypesImpotsNew from "@/components/fiscalite/TypesImpotsNew";
import FiscaliteParametrage from "@/components/fiscalite/FiscaliteParametrage";

export default function Fiscalite() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Générer les années disponibles (5 ans en arrière, année courante, 1 an en avant)
  const years = Array.from({ length: 7 }, (_, i) => currentYear - 5 + i);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Gestion Fiscale</h1>
          <p className="text-muted-foreground mt-2">
            Suivi des impôts, échéances et obligations fiscales
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-muted-foreground" />
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              {years.map(year => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-[800px]">
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Tableau de bord</span>
            <span className="sm:hidden">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Calendrier</span>
            <span className="sm:hidden">Cal.</span>
          </TabsTrigger>
          <TabsTrigger value="types" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Types d'impôts</span>
            <span className="sm:hidden">Types</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Paramétrage</span>
            <span className="sm:hidden">Config</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <FiscaliteDashboard selectedYear={selectedYear} />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-6">
          <CalendrierFiscal selectedYear={selectedYear} />
        </TabsContent>

        <TabsContent value="types" className="space-y-6">
          <TypesImpotsNew />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <FiscaliteParametrage selectedYear={selectedYear} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
