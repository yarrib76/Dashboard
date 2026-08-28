CREATE TABLE IF NOT EXISTS redes_promociones (
  id INT NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(40) NOT NULL,
  nombre VARCHAR(140) NOT NULL,
  descripcion TEXT NULL,
  descuento_pct DECIMAL(6,2) NOT NULL DEFAULT 0,
  envio_gratis TINYINT(1) NOT NULL DEFAULT 0,
  costo_envio_estimado DECIMAL(12,2) NOT NULL DEFAULT 0,
  ganancia_factor DECIMAL(8,4) NOT NULL DEFAULT 0,
  margen_bruto_pct DECIMAL(8,4) NOT NULL DEFAULT 0,
  comision_empleados_pct DECIMAL(6,2) NOT NULL DEFAULT 0,
  comision_cobro_pct DECIMAL(6,2) NOT NULL DEFAULT 0,
  margen_objetivo_pct DECIMAL(6,2) NOT NULL DEFAULT 0,
  minimo_calculado DECIMAL(12,2) NOT NULL DEFAULT 0,
  minimo_recomendado DECIMAL(12,2) NOT NULL DEFAULT 0,
  minimo_publicado DECIMAL(12,2) NOT NULL DEFAULT 0,
  fecha_inicio DATE NULL,
  fecha_fin DATE NULL,
  estado ENUM('borrador', 'activa', 'pausada', 'finalizada') NOT NULL DEFAULT 'borrador',
  creado_por INT NULL,
  actualizado_por INT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_redes_promociones_codigo (codigo),
  KEY idx_redes_promociones_estado_fechas (estado, fecha_inicio, fecha_fin),
  KEY idx_redes_promociones_creado_por (creado_por),
  KEY idx_redes_promociones_actualizado_por (actualizado_por)
);

CREATE TABLE IF NOT EXISTS redes_promocion_canales (
  promocion_id INT NOT NULL,
  canal_id INT NOT NULL,
  PRIMARY KEY (promocion_id, canal_id),
  KEY idx_redes_promocion_canales_canal (canal_id),
  CONSTRAINT fk_redes_promocion_canales_promocion
    FOREIGN KEY (promocion_id) REFERENCES redes_promociones (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_redes_promocion_canales_canal
    FOREIGN KEY (canal_id) REFERENCES redes_plataformas (id)
);

UPDATE controlpedidos
SET fecha_pago = NULL
WHERE fecha_pago = '0000-00-00 00:00:00';

ALTER TABLE controlpedidos
  ADD COLUMN promocion_id INT NULL AFTER instancia,
  ADD KEY idx_controlpedidos_promocion_id (promocion_id),
  ADD CONSTRAINT fk_controlpedidos_promocion
    FOREIGN KEY (promocion_id) REFERENCES redes_promociones (id)
    ON DELETE SET NULL;
