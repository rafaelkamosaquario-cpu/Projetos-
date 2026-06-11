from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class Veiculo(db.Model):
    __tablename__ = "veiculos"
    id = db.Column(db.Integer, primary_key=True)
    placa = db.Column(db.String(10), unique=True, nullable=False)
    modelo = db.Column(db.String(100))
    ano = db.Column(db.Integer)
    ativo = db.Column(db.Boolean, default=True)
    criado_em = db.Column(db.DateTime, default=datetime.now)


class Motorista(db.Model):
    __tablename__ = "motoristas"
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    whatsapp = db.Column(db.String(20), unique=True, nullable=False)
    veiculo_placa = db.Column(db.String(10))
    veiculo_atual_id = db.Column(db.Integer, db.ForeignKey("veiculos.id"))
    ativo = db.Column(db.Boolean, default=True)
    criado_em = db.Column(db.DateTime, default=datetime.now)


class Manutencao(db.Model):
    __tablename__ = "manutencoes"
    id = db.Column(db.Integer, primary_key=True)
    veiculo_id = db.Column(db.Integer, db.ForeignKey("veiculos.id"), nullable=False)
    tipo = db.Column(db.String(100), nullable=False)
    vencimento = db.Column(db.Date, nullable=False)
    agendada = db.Column(db.Boolean, default=False)
    concluida = db.Column(db.Boolean, default=False)
    criado_em = db.Column(db.DateTime, default=datetime.now)


class Documento(db.Model):
    __tablename__ = "documentos"
    id = db.Column(db.Integer, primary_key=True)
    tipo = db.Column(db.String(100), nullable=False)
    referencia = db.Column(db.String(200), nullable=False)
    vencimento = db.Column(db.Date, nullable=False)
    renovado = db.Column(db.Boolean, default=False)
    criado_em = db.Column(db.DateTime, default=datetime.now)


class ChecklistLog(db.Model):
    __tablename__ = "checklist_logs"
    id = db.Column(db.Integer, primary_key=True)
    motorista_id = db.Column(db.Integer, db.ForeignKey("motoristas.id"), nullable=False)
    data = db.Column(db.Date, nullable=False)
    respondido = db.Column(db.Boolean, default=False)
    resposta = db.Column(db.String(200))
    horario_resposta = db.Column(db.DateTime)
    tentativas = db.Column(db.Integer, default=0)
    criado_em = db.Column(db.DateTime, default=datetime.now)
