import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, LinearProgress, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Avatar,
} from '@mui/material';
import { Business, People, LocalHospital } from '@mui/icons-material';
import { organizationApi } from '../services/api';
import PageHeader from '../components/PageHeader';
import { ADMIN_DEPARTMENTS_FALLBACK, ADMIN_STAFF_FALLBACK } from '../data/adminFallback';

function Organization() {
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
        title="组织架构"
        subtitle="管理医院科室结构与医护人员，分配设备监测权限"
        breadcrumbs={[{ label: '管理控制台', path: '/admin' }, { label: '组织架构' }]}
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
                <Chip icon={<People />} label={`${dept.staffCount} 人`} size="small" />
                <Chip label={`${dept.patientCount} 患者`} size="small" variant="outlined" />
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Business color="primary" />
          <Typography variant="h6">医护人员</Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>姓名</TableCell>
                <TableCell>科室</TableCell>
                <TableCell>职位</TableCell>
                <TableCell>角色</TableCell>
                <TableCell>负责患者</TableCell>
                <TableCell>状态</TableCell>
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
                  <TableCell>{person.patients} 人</TableCell>
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
