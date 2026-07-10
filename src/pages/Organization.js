import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, LinearProgress, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Avatar,
} from '@mui/material';
import { Business, People, LocalHospital } from '@mui/icons-material';
import { organizationApi } from '../services/api';
import PageHeader from '../components/PageHeader';
import { ADMIN_DEPARTMENTS_FALLBACK, ADMIN_STAFF_FALLBACK } from '../data/adminFallback';
import { useLang } from '../contexts/LanguageContext';

function Organization() {
  const { t } = useLang();
  const [departments, setDepartments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      organizationApi.getDepartments().catch(() => ({ data: ADMIN_DEPARTMENTS_FALLBACK })),
      organizationApi.getStaff().catch(() => ({ data: ADMIN_STAFF_FALLBACK })),
    ]).then(([d, s]) => {
      setDepartments(d.data || ADMIN_DEPARTMENTS_FALLBACK);
      setStaff(s.data || ADMIN_STAFF_FALLBACK);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <PageHeader
        title={t('组织架构', 'Organization')}
        subtitle={t('管理医院科室结构与医护人员，分配设备监测权限', 'Manage hospital department structure and medical staff, and assign device monitoring permissions')}
        breadcrumbs={[{ label: t('管理控制台', 'Admin Console'), path: '/admin' }, { label: t('组织架构', 'Organization') }]}
      />

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {departments.map(dept => (
          <Grid item xs={12} sm={6} md={3} key={dept.id}>
            <Paper sx={{ p: 2.5, borderLeft: 4, borderColor: 'primary.main' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <LocalHospital color="primary" />
                <Typography variant="h6">{dept.name}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>{dept.description}</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Chip icon={<People />} label={t(`${dept.staffCount} 人`, `${dept.staffCount} staff`)} size="small" />
                <Chip label={t(`${dept.patientCount} 患者`, `${dept.patientCount} patients`)} size="small" variant="outlined" />
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Business color="primary" />
          <Typography variant="h6">{t('医护人员', 'Medical Staff')}</Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('姓名', 'Name')}</TableCell>
                <TableCell>{t('科室', 'Department')}</TableCell>
                <TableCell>{t('职位', 'Title')}</TableCell>
                <TableCell>{t('角色', 'Role')}</TableCell>
                <TableCell>{t('负责患者', 'Patients Managed')}</TableCell>
                <TableCell>{t('状态', 'Status')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {staff.map(person => (
                <TableRow key={person.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14 }}>{person.name[0]}</Avatar>
                      {person.name}
                    </Box>
                  </TableCell>
                  <TableCell>{person.department}</TableCell>
                  <TableCell>{person.title}</TableCell>
                  <TableCell><Chip label={person.role} size="small" color={person.role === '主任' ? 'primary' : 'default'} /></TableCell>
                  <TableCell>{person.patients} {t('人', '')}</TableCell>
                  <TableCell><Chip label={person.status} size="small" color={person.status === '在岗' ? 'success' : 'default'} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

export default Organization;
