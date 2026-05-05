INSERT OR IGNORE INTO grups(nom,curs,descripcio) VALUES ('GrupA','1r','Grup A'),('GrupB','1r','Grup B'),('GrupC','1r','Grup C');
INSERT OR IGNORE INTO tipus_activitat(nom,pes_defecte,requereix_minim,nota_minima,limita_ra,descripcio) VALUES
('Quadern digital',10,0,5,0,'Activitats trivials i evidències de seguiment'),
('Projecte didàctic',45,0,5,0,'Projectes associats a RA i CA'),
('Síntesi pràctica',25,1,5,1,'Activitat de síntesi pràctica amb mínim obligatori'),
('Síntesi teòrica',20,1,5,1,'Activitat de síntesi teòrica amb mínim obligatori');
INSERT OR IGNORE INTO moduls(codi,nom,hores,curs,actiu,descripcio) VALUES ('MP01','Mòdul professional de prova',99,'1r',1,'Mòdul inicial d’exemple');
INSERT OR IGNORE INTO ras(modul_id,codi,descripcio,pes) SELECT id,'RA1','Organitza el treball segons criteris tècnics i didàctics',50 FROM moduls WHERE codi='MP01';
INSERT OR IGNORE INTO ras(modul_id,codi,descripcio,pes) SELECT id,'RA2','Desenvolupa solucions aplicant procediments adequats',50 FROM moduls WHERE codi='MP01';
INSERT OR IGNORE INTO cas(ra_id,codi,descripcio,pes) SELECT id,'CA1.1','Identifica requisits i objectius',40 FROM ras WHERE codi='RA1';
INSERT OR IGNORE INTO cas(ra_id,codi,descripcio,pes) SELECT id,'CA1.2','Planifica tasques i recursos',60 FROM ras WHERE codi='RA1';
INSERT OR IGNORE INTO cas(ra_id,codi,descripcio,pes) SELECT id,'CA2.1','Implementa la solució',70 FROM ras WHERE codi='RA2';
INSERT OR IGNORE INTO cas(ra_id,codi,descripcio,pes) SELECT id,'CA2.2','Documenta i justifica decisions',30 FROM ras WHERE codi='RA2';
