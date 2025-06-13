// frontend/src/pages/DatabaseAdminPage.jsx - VERSION COMPLÈTE AVEC TOUTES LES FONCTIONNALITÉS
import React, { useState, useEffect, useCallback } from 'react';
import {
  FaDatabase,
  FaTable,
  FaEdit,
  FaTrash,
  FaSearch,
  FaEye,
  FaSave,
  FaTimes,
  FaExclamationTriangle,
  FaPlus,
  FaDownload,
  FaUpload,
  FaSync,
  FaFilter,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaCopy,
  FaCode,
  FaChartBar,
  FaSpinner,
  FaCheckCircle,
  FaTimesCircle,
  FaInfoCircle,
  FaCheck,
  FaClone,
  FaFileImport,
  FaFileExport,
  FaHistory
} from 'react-icons/fa';

const DatabaseAdminPage = () => {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState('ASC');
  const [editRecord, setEditRecord] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showQueryEditor, setShowQueryEditor] = useState(false);
  const [customQuery, setCustomQuery] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState({});

  // ✅ NOUVEAUX ÉTATS POUR FONCTIONNALITÉS AVANCÉES
  const [selectedRecords, setSelectedRecords] = useState(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkEditForm, setShowBulkEditForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [importData, setImportData] = useState('');
  const [operationHistory, setOperationHistory] = useState([]);

  // ✅ STYLES CSS COMPLETS
  const styles = {
    container: {
      padding: '20px',
      maxWidth: '1400px',
      margin: '0 auto',
      backgroundColor: '#f8f9fa',
      minHeight: '100vh',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    },
    header: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '24px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
    },
    headerTitle: {
      margin: 0,
      fontSize: '2rem',
      fontWeight: '700',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '8px'
    },
    headerSubtitle: {
      margin: 0,
      fontSize: '1rem',
      opacity: 0.9,
      fontWeight: '400'
    },
    statsContainer: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px',
      marginBottom: '24px'
    },
    statCard: {
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: '#e9ecef',
      transition: 'transform 0.2s, box-shadow 0.2s'
    },
    statValue: {
      fontSize: '2rem',
      fontWeight: '700',
      color: '#495057',
      marginBottom: '4px'
    },
    statLabel: {
      fontSize: '0.875rem',
      color: '#6c757d',
      fontWeight: '500'
    },
    card: {
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      marginBottom: '24px',
      overflow: 'hidden',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: '#e9ecef'
    },
    cardHeader: {
      padding: '20px 24px',
      backgroundColor: '#f8f9fa',
      borderBottomWidth: '1px',
      borderBottomStyle: 'solid',
      borderBottomColor: '#e9ecef',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    cardTitle: {
      margin: 0,
      fontSize: '1.375rem',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      color: '#343a40'
    },
    cardActions: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    cardContent: {
      padding: '24px'
    },
    toolbar: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '20px',
      flexWrap: 'wrap'
    },
    searchContainer: {
      position: 'relative',
      flex: '1',
      minWidth: '300px'
    },
    searchIcon: {
      position: 'absolute',
      left: '12px',
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#6c757d',
      zIndex: 1
    },
    searchInput: {
      padding: '10px 12px 10px 40px',
      borderWidth: '2px',
      borderStyle: 'solid',
      borderColor: '#e9ecef',
      borderRadius: '8px',
      fontSize: '0.875rem',
      width: '100%',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      backgroundColor: 'white'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      gap: '20px',
      marginBottom: '24px'
    },
    tableCard: {
      padding: '20px',
      borderWidth: '2px',
      borderStyle: 'solid',
      borderColor: '#e9ecef',
      borderRadius: '12px',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      backgroundColor: 'white',
      position: 'relative',
      overflow: 'hidden'
    },
    tableCardActive: {
      borderColor: '#007bff',
      boxShadow: '0 8px 24px rgba(0,123,255,0.15)',
      transform: 'translateY(-2px)'
    },
    badge: {
      backgroundColor: '#6c757d',
      color: 'white',
      padding: '4px 10px',
      borderRadius: '6px',
      fontSize: '0.75rem',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    badgeSuccess: {
      backgroundColor: '#28a745'
    },
    badgeInfo: {
      backgroundColor: '#17a2b8'
    },
    badgeWarning: {
      backgroundColor: '#ffc107',
      color: '#212529'
    },
    button: {
      padding: '8px 16px',
      borderWidth: '0',
      borderStyle: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '0.875rem',
      fontWeight: '500',
      transition: 'all 0.2s',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      textDecoration: 'none',
      whiteSpace: 'nowrap'
    },
    buttonPrimary: {
      backgroundColor: '#007bff',
      color: 'white'
    },
    buttonSecondary: {
      backgroundColor: '#6c757d',
      color: 'white'
    },
    buttonSuccess: {
      backgroundColor: '#28a745',
      color: 'white'
    },
    buttonDanger: {
      backgroundColor: '#dc3545',
      color: 'white'
    },
    buttonOutline: {
      backgroundColor: 'transparent',
      borderWidth: '2px',
      borderStyle: 'solid',
      borderColor: '#e9ecef',
      color: '#495057'
    },
    input: {
      padding: '10px 12px',
      borderWidth: '2px',
      borderStyle: 'solid',
      borderColor: '#e9ecef',
      borderRadius: '8px',
      fontSize: '0.875rem',
      width: '100%',
      transition: 'border-color 0.2s, box-shadow 0.2s'
    },
    select: {
      padding: '8px 12px',
      borderWidth: '2px',
      borderStyle: 'solid',
      borderColor: '#e9ecef',
      borderRadius: '8px',
      fontSize: '0.875rem',
      backgroundColor: 'white',
      cursor: 'pointer'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      marginTop: '16px',
      backgroundColor: 'white',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
    },
    th: {
      backgroundColor: '#f8f9fa',
      padding: '16px 12px',
      textAlign: 'left',
      borderBottomWidth: '2px',
      borderBottomStyle: 'solid',
      borderBottomColor: '#e9ecef',
      fontWeight: '600',
      fontSize: '0.875rem',
      color: '#495057',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
      userSelect: 'none'
    },
    td: {
      padding: '12px',
      borderBottomWidth: '1px',
      borderBottomStyle: 'solid',
      borderBottomColor: '#f1f3f4',
      fontSize: '0.875rem',
      maxWidth: '200px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    },
    alert: {
      padding: '16px 20px',
      borderRadius: '8px',
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontSize: '0.875rem',
      fontWeight: '500'
    },
    alertError: {
      backgroundColor: '#f8d7da',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: '#f5c6cb',
      color: '#721c24'
    },
    alertSuccess: {
      backgroundColor: '#d4edda',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: '#c3e6cb',
      color: '#155724'
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
      backdropFilter: 'blur(4px)'
    },
    modalContent: {
      backgroundColor: 'white',
      borderRadius: '12px',
      maxWidth: '700px',
      width: '100%',
      maxHeight: '85vh',
      overflow: 'auto',
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: '#e9ecef'
    },
    modalHeader: {
      padding: '20px 24px',
      borderBottomWidth: '1px',
      borderBottomStyle: 'solid',
      borderBottomColor: '#e9ecef',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#f8f9fa'
    },
    modalTitle: {
      margin: 0,
      fontSize: '1.25rem',
      fontWeight: '600',
      color: '#343a40'
    },
    modalBody: {
      padding: '24px'
    },
    formGroup: {
      marginBottom: '20px'
    },
    label: {
      display: 'block',
      marginBottom: '8px',
      fontWeight: '600',
      fontSize: '0.875rem',
      color: '#495057'
    },
    pagination: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: '24px',
      padding: '16px 0',
      borderTopWidth: '1px',
      borderTopStyle: 'solid',
      borderTopColor: '#e9ecef'
    },
    paginationInfo: {
      fontSize: '0.875rem',
      color: '#6c757d',
      fontWeight: '500'
    },
    paginationButtons: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center'
    },
    loadingSpinner: {
      display: 'inline-block',
      animation: 'spin 1s linear infinite'
    },
    queryEditor: {
      backgroundColor: '#2d3748',
      color: '#e2e8f0',
      padding: '16px',
      borderRadius: '8px',
      fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace",
      fontSize: '0.875rem',
      borderWidth: '0',
      borderStyle: 'none',
      width: '100%',
      minHeight: '200px',
      resize: 'vertical'
    },
    // ✅ NOUVEAUX STYLES POUR SÉLECTION MULTIPLE
    checkbox: {
      width: '18px',
      height: '18px',
      cursor: 'pointer',
      accentColor: '#007bff'
    },
    bulkActionsBar: {
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#007bff',
      color: 'white',
      padding: '16px 24px',
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0,123,255,0.3)',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      zIndex: 1000,
      animation: 'slideUp 0.3s ease'
    },
    selectedCount: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '0.875rem',
      fontWeight: '600'
    },
    bulkActionButton: {
      padding: '8px 16px',
      borderWidth: '2px',
      borderStyle: 'solid',
      borderColor: 'white',
      borderRadius: '8px',
      backgroundColor: 'transparent',
      color: 'white',
      cursor: 'pointer',
      fontSize: '0.875rem',
      fontWeight: '500',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 0.2s'
    },
    importTextarea: {
      width: '100%',
      minHeight: '200px',
      padding: '12px',
      borderWidth: '2px',
      borderStyle: 'solid',
      borderColor: '#e9ecef',
      borderRadius: '8px',
      fontSize: '0.875rem',
      fontFamily: 'monospace',
      resize: 'vertical'
    }
  };

  // Notifications temporaires
  const showNotification = useCallback((message, type = 'success') => {
    if (type === 'success') {
      setSuccess(message);
      setTimeout(() => setSuccess(null), 5000);
    } else {
      setError(message);
      setTimeout(() => setError(null), 5000);
    }

    // Ajouter à l'historique
    const operation = {
      id: Date.now(),
      type,
      message,
      timestamp: new Date(),
      table: selectedTable
    };
    setOperationHistory(prev => [operation, ...prev.slice(0, 9)]); // Garder 10 dernières opérations
  }, [selectedTable]);

  // ✅ FONCTIONS DE SÉLECTION MULTIPLE
  const toggleRecordSelection = (recordId) => {
    const newSelected = new Set(selectedRecords);
    if (newSelected.has(recordId)) {
      newSelected.delete(recordId);
    } else {
      newSelected.add(recordId);
    }
    setSelectedRecords(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  const selectAllRecords = () => {
    if (!tableData || !tableData.rows) return;

    const primaryKey = tableData.columns.find(col => col.primaryKey)?.name || 'id';
    const allIds = new Set(tableData.rows.map(row => row[primaryKey]));
    setSelectedRecords(allIds);
    setShowBulkActions(allIds.size > 0);
  };

  const deselectAllRecords = () => {
    setSelectedRecords(new Set());
    setShowBulkActions(false);
  };

  const isAllSelected = tableData && tableData.rows &&
    tableData.rows.length > 0 &&
    selectedRecords.size === tableData.rows.length;

  const isSomeSelected = selectedRecords.size > 0 && selectedRecords.size < (tableData?.rows?.length || 0);

  // Charger la liste des tables
  const loadTables = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/db-admin/tables', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setTables(data.data);

        const totalTables = data.data.length;
        const totalRecords = data.data.reduce((sum, table) => sum + table.count, 0);
        const emptyTables = data.data.filter(table => table.count === 0).length;
        const tablesWithData = totalTables - emptyTables;

        setStats({
          totalTables,
          totalRecords,
          emptyTables,
          tablesWithData
        });

        setError(null);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur lors du chargement des tables');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Charger les données d'une table
  const loadTableData = useCallback(async (tableName, pageNum = 1, searchTerm = '', orderBy = '', orderDir = 'ASC') => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pageNum,
        limit,
        search: searchTerm,
        ...(orderBy && { orderBy, orderDir })
      });

      const response = await fetch(`/api/db-admin/table/${tableName}?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setTableData(data.data);
        setSelectedTable(tableName);
        setSelectedRecords(new Set()); // Reset selection
        setShowBulkActions(false);
        setError(null);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur lors du chargement des données');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // ✅ SUPPRESSION MULTIPLE
  const bulkDeleteRecords = async () => {
    try {
      setLoading(true);
      const idsArray = Array.from(selectedRecords);

      const response = await fetch(`/api/db-admin/table/${selectedTable}/bulk`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ ids: idsArray })
      });

      const data = await response.json();
      if (data.success) {
        setShowBulkDeleteConfirm(false);
        setSelectedRecords(new Set());
        setShowBulkActions(false);
        loadTableData(selectedTable, page, search, sortBy, sortDir);
        showNotification(`${data.deletedCount} enregistrements supprimés avec succès`);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur lors de la suppression multiple');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ DUPLICATION
  const duplicateRecords = async () => {
    try {
      setLoading(true);
      const idsArray = Array.from(selectedRecords);

      const response = await fetch(`/api/db-admin/table/${selectedTable}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ ids: idsArray })
      });

      const data = await response.json();
      if (data.success) {
        setSelectedRecords(new Set());
        setShowBulkActions(false);
        loadTableData(selectedTable, page, search, sortBy, sortDir);
        showNotification(`${data.duplicatedCount} enregistrements dupliqués avec succès`);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur lors de la duplication');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ ÉDITION EN LOT
  const bulkEditRecords = async (updateData) => {
    try {
      setLoading(true);
      const idsArray = Array.from(selectedRecords);

      const response = await fetch(`/api/db-admin/table/${selectedTable}/bulk`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ ids: idsArray, updateData })
      });

      const data = await response.json();
      if (data.success) {
        setShowBulkEditForm(false);
        setSelectedRecords(new Set());
        setShowBulkActions(false);
        loadTableData(selectedTable, page, search, sortBy, sortDir);
        showNotification(`${data.updatedCount} enregistrements mis à jour avec succès`);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur lors de la mise à jour en lot');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ AJOUT D'ENREGISTREMENT
  const addRecord = async (newData) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/db-admin/table/${selectedTable}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newData)
      });

      const data = await response.json();
      if (data.success) {
        setShowAddForm(false);
        loadTableData(selectedTable, page, search, sortBy, sortDir);
        showNotification('Nouvel enregistrement ajouté avec succès');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur lors de l\'ajout');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ IMPORT CSV
  const importCSV = async () => {
    if (!importData.trim()) {
      setError('Veuillez coller des données CSV');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/db-admin/table/${selectedTable}/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ csvData: importData })
      });

      const data = await response.json();
      if (data.success) {
        setShowImportForm(false);
        setImportData('');
        loadTableData(selectedTable, page, search, sortBy, sortDir);
        showNotification(data.message);
        if (data.errors && data.errors.length > 0) {
          console.warn('Erreurs d\'import:', data.errors);
        }
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur lors de l\'import');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ EXPORT COMPLET
  const exportTable = async () => {
    try {
      const response = await fetch(`/api/db-admin/table/${selectedTable}/export?format=csv`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedTable}_complete_export.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showNotification('Export complet téléchargé avec succès');
      } else {
        const data = await response.json();
        setError(data.message || 'Erreur lors de l\'export');
      }
    } catch (err) {
      setError('Erreur lors de l\'export');
      console.error(err);
    }
  };

  // Exécuter une requête personnalisée
  const executeCustomQuery = async () => {
    if (!customQuery.trim()) {
      setError('Veuillez saisir une requête SQL');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/db-admin/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ query: customQuery })
      });

      const data = await response.json();
      if (data.success) {
        setQueryResult(data.data);
        showNotification('Requête exécutée avec succès');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur lors de l\'exécution de la requête');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Mettre à jour un enregistrement
  const updateRecord = async (tableName, id, updateData) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/db-admin/table/${tableName}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updateData)
      });

      const data = await response.json();
      if (data.success) {
        setEditRecord(null);
        loadTableData(tableName, page, search, sortBy, sortDir);
        showNotification('Enregistrement mis à jour avec succès');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur lors de la mise à jour');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Supprimer un enregistrement
  const deleteRecord = async (tableName, id) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/db-admin/table/${tableName}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setShowDeleteConfirm(null);
        loadTableData(tableName, page, search, sortBy, sortDir);
        showNotification('Enregistrement supprimé avec succès');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur lors de la suppression');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Exporter au format CSV
  const exportToCSV = () => {
    if (!tableData || !tableData.rows.length) return;

    const headers = tableData.columns.map(col => col.name).join(',');
    const rows = tableData.rows.map(row =>
      tableData.columns.map(col => {
        const value = row[col.name];
        return value !== null ? `"${String(value).replace(/"/g, '""')}"` : '';
      }).join(',')
    );

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTable}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showNotification('Export CSV généré avec succès');
  };

  // Tri des colonnes
  const handleSort = (columnName) => {
    if (sortBy === columnName) {
      setSortDir(sortDir === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(columnName);
      setSortDir('ASC');
    }
  };

  // Filtrer les tables
  const filteredTables = tables.filter(table => {
    switch (filter) {
      case 'empty': return table.count === 0;
      case 'withData': return table.count > 0;
      case 'sequelize': return table.hasSequelizeModel;
      default: return true;
    }
  });

  // Effects
  useEffect(() => {
    loadTables();
  }, [loadTables]);

  useEffect(() => {
    if (selectedTable) {
      loadTableData(selectedTable, page, search, sortBy, sortDir);
    }
  }, [page, search, sortBy, sortDir, selectedTable, loadTableData]);

  // ✅ COMPOSANTS
  const LoadingSpinner = () => (
    <FaSpinner style={styles.loadingSpinner} />
  );

  const StatCard = ({ icon: Icon, value, label, color = '#007bff' }) => (
    <div style={styles.statCard}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Icon style={{ fontSize: '2rem', color }} />
        <div>
          <div style={styles.statValue}>{value}</div>
          <div style={styles.statLabel}>{label}</div>
        </div>
      </div>
    </div>
  );

  // ✅ BARRE D'ACTIONS EN LOT
  const BulkActionsBar = () => (
    showBulkActions && (
      <div style={styles.bulkActionsBar}>
        <div style={styles.selectedCount}>
          {selectedRecords.size} sélectionnés
        </div>

        <button
          style={styles.bulkActionButton}
          onClick={() => setShowBulkDeleteConfirm(true)}
        >
          <FaTrash />
          Supprimer
        </button>

        <button
          style={styles.bulkActionButton}
          onClick={duplicateRecords}
          disabled={loading}
        >
          <FaClone />
          Dupliquer
        </button>

        <button
          style={styles.bulkActionButton}
          onClick={() => setShowBulkEditForm(true)}
        >
          <FaEdit />
          Modifier
        </button>

        <button
          style={styles.bulkActionButton}
          onClick={deselectAllRecords}
        >
          <FaTimes />
          Annuler
        </button>
      </div>
    )
  );

  // ✅ FORMULAIRE D'AJOUT
  const AddForm = ({ columns, onSave, onCancel }) => {
    const [formData, setFormData] = useState({});
    const [saving, setSaving] = useState(false);

    const editableColumns = columns.filter(col =>
      !(col.primaryKey || col.autoIncrement)
    );

    const handleSubmit = async (e) => {
      e.preventDefault();
      setSaving(true);
      await onSave(formData);
      setSaving(false);
    };

    return (
      <div style={styles.modal}>
        <div style={styles.modalContent}>
          <div style={styles.modalHeader}>
            <h3 style={styles.modalTitle}>
              <FaPlus style={{ marginRight: '8px' }} />
              Ajouter un enregistrement
            </h3>
            <button
              style={{ ...styles.button, ...styles.buttonOutline }}
              onClick={onCancel}
              disabled={saving}
            >
              <FaTimes />
            </button>
          </div>
          <div style={styles.modalBody}>
            <form onSubmit={handleSubmit}>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {editableColumns.map(col => (
                  <div key={col.name} style={styles.formGroup}>
                    <label style={styles.label}>
                      {col.name}
                      <span style={{ ...styles.badge, marginLeft: '8px' }}>{col.type}</span>
                      {!col.allowNull && <span style={{ color: 'red', marginLeft: '4px' }}>*</span>}
                    </label>
                    {col.type.includes('TEXT') ? (
                      <textarea
                        style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
                        value={formData[col.name] || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          [col.name]: e.target.value
                        })}
                        required={!col.allowNull}
                      />
                    ) : (
                      <input
                        style={styles.input}
                        type={col.type.includes('INT') ? 'number' : col.type.includes('DATE') ? 'datetime-local' : 'text'}
                        value={formData[col.name] || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          [col.name]: e.target.value
                        })}
                        required={!col.allowNull}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  style={{ ...styles.button, ...styles.buttonOutline }}
                  onClick={onCancel}
                  disabled={saving}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{ ...styles.button, ...styles.buttonSuccess }}
                  disabled={saving}
                >
                  {saving ? <LoadingSpinner /> : <FaSave />}
                  {saving ? 'Ajout...' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  // ✅ FORMULAIRE D'ÉDITION EN LOT
  const BulkEditForm = ({ columns, onSave, onCancel }) => {
    const [formData, setFormData] = useState({});
    const [saving, setSaving] = useState(false);

    const editableColumns = columns.filter(col =>
      !(col.primaryKey || col.autoIncrement)
    );

    const handleSubmit = async (e) => {
      e.preventDefault();
      setSaving(true);

      // Filtrer les champs vides
      const updateData = {};
      Object.keys(formData).forEach(key => {
        if (formData[key] !== '' && formData[key] !== null && formData[key] !== undefined) {
          updateData[key] = formData[key];
        }
      });

      if (Object.keys(updateData).length === 0) {
        setError('Veuillez remplir au moins un champ à modifier');
        setSaving(false);
        return;
      }

      await onSave(updateData);
      setSaving(false);
    };

    return (
      <div style={styles.modal}>
        <div style={styles.modalContent}>
          <div style={styles.modalHeader}>
            <h3 style={styles.modalTitle}>
              <FaEdit style={{ marginRight: '8px' }} />
              Modifier {selectedRecords.size} enregistrements
            </h3>
            <button
              style={{ ...styles.button, ...styles.buttonOutline }}
              onClick={onCancel}
              disabled={saving}
            >
              <FaTimes />
            </button>
          </div>
          <div style={styles.modalBody}>
            <div style={{ ...styles.alert, backgroundColor: '#fff3cd', color: '#856404', borderColor: '#ffeaa7' }}>
              <FaInfoCircle />
              Seuls les champs remplis seront modifiés. Laissez vide pour ignorer.
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {editableColumns.map(col => (
                  <div key={col.name} style={styles.formGroup}>
                    <label style={styles.label}>
                      {col.name}
                      <span style={{ ...styles.badge, marginLeft: '8px' }}>{col.type}</span>
                    </label>
                    {col.type.includes('TEXT') ? (
                      <textarea
                        style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
                        value={formData[col.name] || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          [col.name]: e.target.value
                        })}
                        placeholder={`Nouvelle valeur pour ${col.name} (optionnel)`}
                      />
                    ) : (
                      <input
                        style={styles.input}
                        type={col.type.includes('INT') ? 'number' : col.type.includes('DATE') ? 'datetime-local' : 'text'}
                        value={formData[col.name] || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          [col.name]: e.target.value
                        })}
                        placeholder={`Nouvelle valeur pour ${col.name} (optionnel)`}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  style={{ ...styles.button, ...styles.buttonOutline }}
                  onClick={onCancel}
                  disabled={saving}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{ ...styles.button, ...styles.buttonSuccess }}
                  disabled={saving}
                >
                  {saving ? <LoadingSpinner /> : <FaSave />}
                  {saving ? 'Modification...' : `Modifier ${selectedRecords.size} enregistrements`}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  // ✅ FORMULAIRE D'IMPORT
  const ImportForm = ({ onImport, onCancel }) => {
    return (
      <div style={styles.modal}>
        <div style={styles.modalContent}>
          <div style={styles.modalHeader}>
            <h3 style={styles.modalTitle}>
              <FaFileImport style={{ marginRight: '8px' }} />
              Importer des données CSV
            </h3>
            <button
              style={{ ...styles.button, ...styles.buttonOutline }}
              onClick={onCancel}
            >
              <FaTimes />
            </button>
          </div>
          <div style={styles.modalBody}>
            <div style={{ ...styles.alert, backgroundColor: '#d1ecf1', color: '#0c5460', borderColor: '#bee5eb' }}>
              <FaInfoCircle />
              Collez vos données CSV avec les en-têtes sur la première ligne.
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Données CSV :</label>
              <textarea
                style={styles.importTextarea}
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder={`nom,email,age\nJohn Doe,john@example.com,30\nJane Smith,jane@example.com,25`}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                style={{ ...styles.button, ...styles.buttonOutline }}
                onClick={onCancel}
              >
                Annuler
              </button>
              <button
                style={{ ...styles.button, ...styles.buttonSuccess }}
                onClick={onImport}
                disabled={loading || !importData.trim()}
              >
                {loading ? <LoadingSpinner /> : <FaFileImport />}
                {loading ? 'Import...' : 'Importer'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const EditForm = ({ record, columns, onSave, onCancel }) => {
    const [formData, setFormData] = useState({ ...record });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      setSaving(true);
      await onSave(formData);
      setSaving(false);
    };

    return (
      <div style={styles.modal}>
        <div style={styles.modalContent}>
          <div style={styles.modalHeader}>
            <h3 style={styles.modalTitle}>
              <FaEdit style={{ marginRight: '8px' }} />
              Modifier l'enregistrement
            </h3>
            <button
              style={{ ...styles.button, ...styles.buttonOutline }}
              onClick={onCancel}
              disabled={saving}
            >
              <FaTimes />
            </button>
          </div>
          <div style={styles.modalBody}>
            <form onSubmit={handleSubmit}>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {columns.map(col => (
                  <div key={col.name} style={styles.formGroup}>
                    <label style={styles.label}>
                      {col.name}
                      <div style={{ display: 'inline-flex', gap: '4px', marginLeft: '8px' }}>
                        {col.primaryKey && (
                          <span style={{ ...styles.badge, ...styles.badgeInfo }}>PK</span>
                        )}
                        {col.autoIncrement && (
                          <span style={{ ...styles.badge, ...styles.badgeWarning }}>AUTO</span>
                        )}
                        <span style={styles.badge}>{col.type}</span>
                      </div>
                    </label>
                    {col.type.includes('TEXT') ? (
                      <textarea
                        style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
                        value={formData[col.name] || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          [col.name]: e.target.value
                        })}
                        disabled={col.primaryKey || col.autoIncrement || saving}
                      />
                    ) : (
                      <input
                        style={styles.input}
                        type={col.type.includes('INT') ? 'number' : col.type.includes('DATE') ? 'datetime-local' : 'text'}
                        value={formData[col.name] || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          [col.name]: e.target.value
                        })}
                        disabled={col.primaryKey || col.autoIncrement || saving}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  style={{ ...styles.button, ...styles.buttonOutline }}
                  onClick={onCancel}
                  disabled={saving}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{ ...styles.button, ...styles.buttonSuccess }}
                  disabled={saving}
                >
                  {saving ? <LoadingSpinner /> : <FaSave />}
                  {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {/* CSS Animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(100%); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>
          <FaDatabase />
          Administration Base de Données
          {loading && <LoadingSpinner />}
        </h1>
        <p style={styles.headerSubtitle}>
          Gérez vos tables, données et requêtes en toute sécurité
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ ...styles.alert, ...styles.alertError }}>
          <FaTimesCircle />
          {error}
          <button
            style={{ marginLeft: 'auto', background: 'none', borderWidth: '0', borderStyle: 'none', color: 'inherit', cursor: 'pointer' }}
            onClick={() => setError(null)}
          >
            <FaTimes />
          </button>
        </div>
      )}

      {success && (
        <div style={{ ...styles.alert, ...styles.alertSuccess }}>
          <FaCheckCircle />
          {success}
          <button
            style={{ marginLeft: 'auto', background: 'none', borderWidth: '0', borderStyle: 'none', color: 'inherit', cursor: 'pointer' }}
            onClick={() => setSuccess(null)}
          >
            <FaTimes />
          </button>
        </div>
      )}

      {/* Statistiques */}
      <div style={styles.statsContainer}>
        <StatCard icon={FaTable} value={stats.totalTables || 0} label="Tables Total" color="#007bff" />
        <StatCard icon={FaChartBar} value={stats.totalRecords || 0} label="Enregistrements" color="#28a745" />
        <StatCard icon={FaDatabase} value={stats.tablesWithData || 0} label="Tables avec données" color="#17a2b8" />
        <StatCard icon={FaExclamationTriangle} value={stats.emptyTables || 0} label="Tables vides" color="#ffc107" />
      </div>

      {/* Historique des opérations */}
      {operationHistory.length > 0 && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>
              <FaHistory />
              Historique des opérations
            </h3>
            <button
              style={{ ...styles.button, ...styles.buttonOutline }}
              onClick={() => setOperationHistory([])}
            >
              <FaTimes />
              Effacer
            </button>
          </div>
          <div style={styles.cardContent}>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {operationHistory.map(op => (
                <div key={op.id} style={{
                  padding: '8px 12px',
                  marginBottom: '8px',
                  backgroundColor: op.type === 'success' ? '#d4edda' : '#f8d7da',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{op.message}</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                      {op.timestamp.toLocaleTimeString()} - {op.table}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Liste des tables */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>
            <FaTable />
            Tables de la base de données
            <span style={{ ...styles.badge, ...styles.badgeInfo }}>{filteredTables.length}</span>
          </h2>
          <div style={styles.cardActions}>
            <select
              style={styles.select}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Toutes les tables</option>
              <option value="withData">Avec données</option>
              <option value="empty">Vides</option>
              <option value="sequelize">Modèles Sequelize</option>
            </select>
            <button
              style={{ ...styles.button, ...styles.buttonPrimary }}
              onClick={() => setShowQueryEditor(!showQueryEditor)}
            >
              <FaCode />
              Éditeur SQL
            </button>
            <button
              style={{ ...styles.button, ...styles.buttonSecondary }}
              onClick={loadTables}
              disabled={loading}
            >
              <FaSync />
              Actualiser
            </button>
          </div>
        </div>
        <div style={styles.cardContent}>
          <div style={styles.grid}>
            {filteredTables.map(table => (
              <div
                key={table.name}
                style={{
                  ...styles.tableCard,
                  ...(selectedTable === table.name ? styles.tableCardActive : {})
                }}
                onClick={() => {
                  setPage(1);
                  setSearch('');
                  setSortBy('');
                  setSortDir('ASC');
                  loadTableData(table.name);
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.125rem', fontWeight: '600' }}>
                    <FaTable style={{ color: '#007bff' }} />
                    {table.name}
                  </h3>
                  <span style={{ ...styles.badge, ...(table.count > 0 ? styles.badgeSuccess : {}) }}>
                    {table.count} lignes
                  </span>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6c757d', marginBottom: '8px' }}>
                  <strong>{table.attributes.length}</strong> colonnes
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {table.hasSequelizeModel && (
                    <span style={{ ...styles.badge, ...styles.badgeInfo, fontSize: '0.625rem' }}>
                      Sequelize
                    </span>
                  )}
                  <span style={{ ...styles.badge, fontSize: '0.625rem' }}>
                    {table.source}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Éditeur de requêtes */}
      {showQueryEditor && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>
              <FaCode />
              Éditeur de requêtes SQL
            </h3>
            <button
              style={{ ...styles.button, ...styles.buttonOutline }}
              onClick={() => setShowQueryEditor(false)}
            >
              <FaTimes />
            </button>
          </div>
          <div style={styles.cardContent}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Requête SQL :</label>
              <textarea
                style={styles.queryEditor}
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="SELECT * FROM nom_table LIMIT 10;"
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <button
                style={{ ...styles.button, ...styles.buttonPrimary }}
                onClick={executeCustomQuery}
                disabled={loading || !customQuery.trim()}
              >
                {loading ? <LoadingSpinner /> : <FaCode />}
                Exécuter
              </button>
              <button
                style={{ ...styles.button, ...styles.buttonOutline }}
                onClick={() => setCustomQuery('')}
              >
                <FaTimes />
                Effacer
              </button>
            </div>

            {/* Résultat de la requête */}
            {queryResult && (
              <div style={{ marginTop: '20px' }}>
                <h4>Résultat de la requête :</h4>
                <div style={{ backgroundColor: '#f8f9fa', padding: '16px', borderRadius: '8px', maxHeight: '400px', overflow: 'auto' }}>
                  <pre style={{ margin: 0, fontSize: '0.875rem' }}>
                    {JSON.stringify(queryResult, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table de données sélectionnée */}
      {selectedTable && tableData && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>
              <FaTable />
              {selectedTable}
              <span style={styles.badge}>{tableData.total} enregistrements</span>
            </h2>
            <div style={styles.cardActions}>
              <button
                style={{ ...styles.button, ...styles.buttonSuccess }}
                onClick={() => setShowAddForm(true)}
              >
                <FaPlus />
                Ajouter
              </button>
              <button
                style={{ ...styles.button, ...styles.buttonPrimary }}
                onClick={() => setShowImportForm(true)}
              >
                <FaFileImport />
                Importer CSV
              </button>
              <button
                style={{ ...styles.button, ...styles.buttonSecondary }}
                onClick={exportTable}
              >
                <FaFileExport />
                Export Complet
              </button>
              <button
                style={{ ...styles.button, ...styles.buttonSecondary }}
                onClick={exportToCSV}
              >
                <FaDownload />
                Export Page
              </button>
            </div>
          </div>
          <div style={styles.cardContent}>
            {/* Barre de recherche */}
            <div style={styles.toolbar}>
              <div style={styles.searchContainer}>
                <FaSearch style={styles.searchIcon} />
                <input
                  style={styles.searchInput}
                  type="text"
                  placeholder="Rechercher dans les données..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                style={styles.select}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              >
                <option value={10}>10 par page</option>
                <option value={20}>20 par page</option>
                <option value={50}>50 par page</option>
                <option value={100}>100 par page</option>
              </select>
            </div>

            {/* Table des données avec sélection multiple */}
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>
                      <input
                        type="checkbox"
                        style={styles.checkbox}
                        checked={isAllSelected}
                        ref={input => {
                          if (input) input.indeterminate = isSomeSelected;
                        }}
                        onChange={(e) => {
                          if (e.target.checked) {
                            selectAllRecords();
                          } else {
                            deselectAllRecords();
                          }
                        }}
                      />
                    </th>
                    {tableData.columns.map(col => (
                      <th
                        key={col.name}
                        style={styles.th}
                        onClick={() => handleSort(col.name)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {col.name}
                          {col.primaryKey && <span style={{ ...styles.badge, ...styles.badgeInfo, fontSize: '0.625rem' }}>PK</span>}
                          {sortBy === col.name && (
                            sortDir === 'ASC' ? <FaSortUp /> : <FaSortDown />
                          )}
                          {sortBy !== col.name && <FaSort style={{ opacity: 0.3 }} />}
                        </div>
                      </th>
                    ))}
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.map((row, index) => {
                    const primaryKey = tableData.columns.find(col => col.primaryKey)?.name || 'id';
                    const rowId = row[primaryKey];

                    return (
                      <tr key={index}>
                        <td style={styles.td}>
                          <input
                            type="checkbox"
                            style={styles.checkbox}
                            checked={selectedRecords.has(rowId)}
                            onChange={() => toggleRecordSelection(rowId)}
                          />
                        </td>
                        {tableData.columns.map(col => (
                          <td key={col.name} style={styles.td} title={row[col.name]}>
                            {row[col.name] !== null ? String(row[col.name]) : ''}
                          </td>
                        ))}
                        <td style={styles.td}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              style={{ ...styles.button, ...styles.buttonPrimary, padding: '4px 8px' }}
                              onClick={() => setEditRecord({ record: row, columns: tableData.columns })}
                              title="Modifier"
                            >
                              <FaEdit />
                            </button>
                            <button
                              style={{ ...styles.button, ...styles.buttonDanger, padding: '4px 8px' }}
                              onClick={() => setShowDeleteConfirm({ table: selectedTable, id: rowId, record: row })}
                              title="Supprimer"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={styles.pagination}>
              <div style={styles.paginationInfo}>
                Affichage de {((page - 1) * limit) + 1} à {Math.min(page * limit, tableData.total)} sur {tableData.total} enregistrements
              </div>
              <div style={styles.paginationButtons}>
                <button
                  style={{ ...styles.button, ...styles.buttonOutline }}
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                >
                  Précédent
                </button>
                <span style={{ padding: '0 12px', fontSize: '0.875rem' }}>
                  Page {page} sur {tableData.totalPages}
                </span>
                <button
                  style={{ ...styles.button, ...styles.buttonOutline }}
                  onClick={() => setPage(Math.min(tableData.totalPages, page + 1))}
                  disabled={page === tableData.totalPages}
                >
                  Suivant
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barre d'actions en lot */}
      <BulkActionsBar />

      {/* Modals */}
      {showAddForm && tableData && (
        <AddForm
          columns={tableData.columns}
          onSave={addRecord}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {showBulkEditForm && tableData && (
        <BulkEditForm
          columns={tableData.columns}
          onSave={bulkEditRecords}
          onCancel={() => setShowBulkEditForm(false)}
        />
      )}

      {showImportForm && (
        <ImportForm
          onImport={importCSV}
          onCancel={() => setShowImportForm(false)}
        />
      )}

      {/* Modal d'édition */}
      {editRecord && (
        <EditForm
          record={editRecord.record}
          columns={editRecord.columns}
          onSave={(formData) => {
            const primaryKey = editRecord.columns.find(col => col.primaryKey)?.name || 'id';
            const id = editRecord.record[primaryKey];
            updateRecord(selectedTable, id, formData);
          }}
          onCancel={() => setEditRecord(null)}
        />
      )}

      {/* Modal de confirmation de suppression simple */}
      {showDeleteConfirm && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                <FaExclamationTriangle style={{ marginRight: '8px', color: '#ffc107' }} />
                Confirmer la suppression
              </h3>
            </div>
            <div style={styles.modalBody}>
              <p>Êtes-vous sûr de vouloir supprimer cet enregistrement ?</p>
              <p><strong>Cette action est irréversible.</strong></p>
              <div style={{ backgroundColor: '#f8f9fa', padding: '12px', borderRadius: '6px', marginTop: '16px' }}>
                <pre style={{ margin: 0, fontSize: '0.75rem', maxHeight: '150px', overflow: 'auto' }}>
                  {JSON.stringify(showDeleteConfirm.record, null, 2)}
                </pre>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button
                  style={{ ...styles.button, ...styles.buttonOutline }}
                  onClick={() => setShowDeleteConfirm(null)}
                >
                  Annuler
                </button>
                <button
                  style={{ ...styles.button, ...styles.buttonDanger }}
                  onClick={() => deleteRecord(showDeleteConfirm.table, showDeleteConfirm.id)}
                  disabled={loading}
                >
                  {loading ? <LoadingSpinner /> : <FaTrash />}
                  {loading ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation de suppression en lot */}
      {showBulkDeleteConfirm && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                <FaExclamationTriangle style={{ marginRight: '8px', color: '#ffc107' }} />
                Confirmer la suppression en lot
              </h3>
            </div>
            <div style={styles.modalBody}>
              <p>Êtes-vous sûr de vouloir supprimer <strong>{selectedRecords.size} enregistrements</strong> ?</p>
              <p><strong>Cette action est irréversible.</strong></p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button
                  style={{ ...styles.button, ...styles.buttonOutline }}
                  onClick={() => setShowBulkDeleteConfirm(false)}
                >
                  Annuler
                </button>
                <button
                  style={{ ...styles.button, ...styles.buttonDanger }}
                  onClick={bulkDeleteRecords}
                  disabled={loading}
                >
                  {loading ? <LoadingSpinner /> : <FaTrash />}
                  {loading ? 'Suppression...' : `Supprimer ${selectedRecords.size} enregistrements`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseAdminPage;