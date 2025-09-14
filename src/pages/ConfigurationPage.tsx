import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { Settings, Euro, Globe, Clock, Palette, FolderOpen, Briefcase, Plus, Edit2 } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  budget_monthly: number | null;
}

interface ProjectCode {
  id: string;
  code: string;
  name: string;
  status: string;
}

export default function ConfigurationPage() {
  const { profile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [projectCodes, setProjectCodes] = useState<ProjectCode[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Configuration states
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('es');
  const [timezone, setTimezone] = useState('Europe/Madrid');
  const [currency, setCurrency] = useState('EUR');
  const [defaultVat, setDefaultVat] = useState('21');
  const [autoApprovalLimit, setAutoApprovalLimit] = useState('100');
  const [sandboxMode, setSandboxMode] = useState(false);

  // Dialog states
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingProject, setEditingProject] = useState<ProjectCode | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryBudget, setNewCategoryBudget] = useState('');
  const [newProjectCode, setNewProjectCode] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isAddingProject, setIsAddingProject] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [categoriesRes, projectCodesRes] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('project_codes').select('*').eq('status', 'ACTIVE').order('code')
      ]);

      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (projectCodesRes.data) setProjectCodes(projectCodesRes.data);
    } catch (error) {
      console.error('Error loading configuration data:', error);
      toast.error('Error al cargar los datos de configuración');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    try {
      // Here you would typically save to a user preferences table
      // For now, just simulate saving
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success('Preferencias guardadas correctamente');
    } catch (error) {
      toast.error('Error al guardar preferencias');
    }
  };

  const saveFinancialConfig = async () => {
    try {
      // Here you would typically save to a system configuration table
      // For now, just simulate saving
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success('Configuración financiera guardada correctamente');
    } catch (error) {
      toast.error('Error al guardar configuración financiera');
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setNewCategoryBudget(category.budget_monthly?.toString() || '');
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;
    
    try {
      const { error } = await supabase
        .from('categories')
        .update({
          name: newCategoryName,
          budget_monthly: newCategoryBudget ? parseFloat(newCategoryBudget) : null
        })
        .eq('id', editingCategory.id);

      if (error) throw error;

      toast.success('Categoría actualizada correctamente');
      setEditingCategory(null);
      loadData();
    } catch (error) {
      toast.error('Error al actualizar categoría');
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('El nombre de la categoría es requerido');
      return;
    }

    try {
      const { error } = await supabase
        .from('categories')
        .insert({
          name: newCategoryName,
          budget_monthly: newCategoryBudget ? parseFloat(newCategoryBudget) : null
        });

      if (error) throw error;

      toast.success('Categoría añadida correctamente');
      setIsAddingCategory(false);
      setNewCategoryName('');
      setNewCategoryBudget('');
      loadData();
    } catch (error) {
      toast.error('Error al añadir categoría');
    }
  };

  const handleEditProject = (project: ProjectCode) => {
    setEditingProject(project);
    setNewProjectCode(project.code);
    setNewProjectName(project.name);
  };

  const handleUpdateProject = async () => {
    if (!editingProject) return;
    
    try {
      const { error } = await supabase
        .from('project_codes')
        .update({
          code: newProjectCode,
          name: newProjectName
        })
        .eq('id', editingProject.id);

      if (error) throw error;

      toast.success('Código de proyecto actualizado correctamente');
      setEditingProject(null);
      loadData();
    } catch (error) {
      toast.error('Error al actualizar código de proyecto');
    }
  };

  const handleAddProject = async () => {
    if (!newProjectCode.trim() || !newProjectName.trim()) {
      toast.error('El código y nombre del proyecto son requeridos');
      return;
    }

    try {
      const { error } = await supabase
        .from('project_codes')
        .insert({
          code: newProjectCode,
          name: newProjectName,
          status: 'ACTIVE'
        });

      if (error) throw error;

      toast.success('Código de proyecto añadido correctamente');
      setIsAddingProject(false);
      setNewProjectCode('');
      setNewProjectName('');
      loadData();
    } catch (error) {
      toast.error('Error al añadir código de proyecto');
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando configuración...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Preferencias Generales */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Palette className="h-5 w-5" />
                <span>Preferencias Generales</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tema Oscuro */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Tema Oscuro</Label>
                  <p className="text-xs text-muted-foreground">Alternar entre tema claro y oscuro</p>
                </div>
                <Switch
                  checked={darkMode}
                  onCheckedChange={setDarkMode}
                />
              </div>

              <Separator />

              {/* Idioma */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Idioma</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Zona Horaria */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Zona Horaria</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Europe/Madrid">Europe/Madrid</SelectItem>
                    <SelectItem value="Europe/London">Europe/London</SelectItem>
                    <SelectItem value="America/New_York">America/New_York</SelectItem>
                    <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={savePreferences} className="w-full">
                Guardar Preferencias
              </Button>
            </CardContent>
          </Card>

          {/* Configuración Financiera */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Euro className="h-5 w-5" />
                <span>Configuración Financiera</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Moneda Base */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Moneda Base</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* IVA por Defecto */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">IVA por Defecto (%)</Label>
                <Input
                  type="number"
                  value={defaultVat}
                  onChange={(e) => setDefaultVat(e.target.value)}
                  placeholder="21"
                />
              </div>

              {/* Límite Aprobación Automática */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Límite Aprobación Automática (€)</Label>
                <Input
                  type="number"
                  value={autoApprovalLimit}
                  onChange={(e) => setAutoApprovalLimit(e.target.value)}
                  placeholder="100"
                />
                <p className="text-xs text-muted-foreground">
                  Gastos menores a este importe se aprueban automáticamente
                </p>
              </div>

              {/* Modo Sandbox */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Modo Sandbox</Label>
                  <p className="text-xs text-muted-foreground">Activar para pruebas sin facturación real</p>
                </div>
                <Switch
                  checked={sandboxMode}
                  onCheckedChange={setSandboxMode}
                />
              </div>

              <Button onClick={saveFinancialConfig} className="w-full">
                Guardar Configuración
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gestión de Categorías */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FolderOpen className="h-5 w-5" />
                <span>Gestión de Categorías</span>
              </CardTitle>
              <CardDescription>Categorías Activas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                    <span className="font-medium">{category.name}</span>
                    {category.budget_monthly && (
                      <Badge variant="outline">
                        Presupuesto: {category.budget_monthly}€/mes
                      </Badge>
                    )}
                  </div>
                  <Dialog open={editingCategory?.id === category.id} onOpenChange={(open) => !open && setEditingCategory(null)}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => handleEditCategory(category)}>
                        <Edit2 className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Editar Categoría</DialogTitle>
                        <DialogDescription>
                          Modifica los datos de la categoría
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="category-name">Nombre</Label>
                          <Input
                            id="category-name"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="Nombre de la categoría"
                          />
                        </div>
                        <div>
                          <Label htmlFor="category-budget">Presupuesto Mensual (€)</Label>
                          <Input
                            id="category-budget"
                            type="number"
                            value={newCategoryBudget}
                            onChange={(e) => setNewCategoryBudget(e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button variant="outline" onClick={() => setEditingCategory(null)}>
                            Cancelar
                          </Button>
                          <Button onClick={handleUpdateCategory}>
                            Guardar
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              ))}
              
              <Dialog open={isAddingCategory} onOpenChange={setIsAddingCategory}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir Categoría
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nueva Categoría</DialogTitle>
                    <DialogDescription>
                      Añade una nueva categoría de gastos
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="new-category-name">Nombre</Label>
                      <Input
                        id="new-category-name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Nombre de la categoría"
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-category-budget">Presupuesto Mensual (€)</Label>
                      <Input
                        id="new-category-budget"
                        type="number"
                        value={newCategoryBudget}
                        onChange={(e) => setNewCategoryBudget(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => {
                        setIsAddingCategory(false);
                        setNewCategoryName('');
                        setNewCategoryBudget('');
                      }}>
                        Cancelar
                      </Button>
                      <Button onClick={handleAddCategory}>
                        Añadir
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Códigos de Proyecto */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Briefcase className="h-5 w-5" />
                <span>Códigos de Proyecto</span>
              </CardTitle>
              <CardDescription>Proyectos Activos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {projectCodes.map((project) => (
                <div key={project.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <div className="font-medium">{project.code}</div>
                    <div className="text-sm text-muted-foreground">{project.name}</div>
                  </div>
                  <Dialog open={editingProject?.id === project.id} onOpenChange={(open) => !open && setEditingProject(null)}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => handleEditProject(project)}>
                        <Edit2 className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Editar Código de Proyecto</DialogTitle>
                        <DialogDescription>
                          Modifica los datos del código de proyecto
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="project-code">Código</Label>
                          <Input
                            id="project-code"
                            value={newProjectCode}
                            onChange={(e) => setNewProjectCode(e.target.value)}
                            placeholder="Código del proyecto"
                          />
                        </div>
                        <div>
                          <Label htmlFor="project-name">Nombre</Label>
                          <Input
                            id="project-name"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            placeholder="Nombre del proyecto"
                          />
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button variant="outline" onClick={() => setEditingProject(null)}>
                            Cancelar
                          </Button>
                          <Button onClick={handleUpdateProject}>
                            Guardar
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              ))}
              
              <Dialog open={isAddingProject} onOpenChange={setIsAddingProject}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-primary hover:bg-primary/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir Proyecto
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nuevo Código de Proyecto</DialogTitle>
                    <DialogDescription>
                      Añade un nuevo código de proyecto
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="new-project-code">Código</Label>
                      <Input
                        id="new-project-code"
                        value={newProjectCode}
                        onChange={(e) => setNewProjectCode(e.target.value)}
                        placeholder="Código del proyecto"
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-project-name">Nombre</Label>
                      <Input
                        id="new-project-name"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="Nombre del proyecto"
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => {
                        setIsAddingProject(false);
                        setNewProjectCode('');
                        setNewProjectName('');
                      }}>
                        Cancelar
                      </Button>
                      <Button onClick={handleAddProject}>
                        Añadir
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}